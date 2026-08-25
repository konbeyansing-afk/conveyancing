/**
 * buildSettlementStatement — the buyer and seller formulas, and the
 * balance-check's internal consistency guarantee.
 */

import { describe, expect, it } from "vitest";
import { buildSettlementStatement } from "@/lib/settlement/statement";
import { newSettlementCosts } from "@/lib/settlement/costs";
import { dollarsToCents } from "@/lib/settlement/money";
import type { AdjustmentCalculationResult, LedgerEntry, MatterDetails } from "@/lib/settlement/types";

function baseMatter(patch: Partial<MatterDetails> = {}): MatterDetails {
  return {
    transactionType: "PURCHASE",
    propertyAddress: "1 Test Street",
    contractDate: "2026-07-01",
    settlementDate: "2026-08-15",
    contractPriceCents: dollarsToCents(850_000),
    depositPaidCents: dollarsToCents(85_000),
    loanProceedsCents: dollarsToCents(680_000),
    clientFundsCents: null,
    ...patch,
  };
}

function adjustment(
  id: string,
  amountCents: number,
  debitParty: "BUYER" | "SELLER",
  category: LedgerEntry["category"] = "RATES",
): AdjustmentCalculationResult {
  const creditParty = debitParty === "BUYER" ? "SELLER" : "BUYER";
  const ledgerEntries: LedgerEntry[] = [
    { party: debitParty, side: "DEBIT", amountCents, description: `${category} adj`, sourceAdjustmentId: id, category },
    { party: creditParty, side: "CREDIT", amountCents, description: `${category} adj`, sourceAdjustmentId: id, category },
  ];
  return { id, pending: false, messages: [], tier: "ok", automatic: { ledgerEntries, trail: [] }, override: null, effective: { ledgerEntries, source: "automatic" } };
}

describe("buildSettlementStatement — buyer formula", () => {
  it("balance required = price - deposit - loan, with no adjustments or costs", () => {
    const statement = buildSettlementStatement(baseMatter(), [], newSettlementCosts());
    // 850,000 - 85,000 - 680,000 = 85,000
    expect(statement.buyer.balanceRequiredCents).toBe(dollarsToCents(85_000));
  });

  it("a buyer debit increases the balance required", () => {
    const statement = buildSettlementStatement(baseMatter(), [adjustment("a1", dollarsToCents(500), "BUYER")], newSettlementCosts());
    expect(statement.buyer.balanceRequiredCents).toBe(dollarsToCents(85_500));
  });

  it("a buyer credit decreases the balance required", () => {
    const statement = buildSettlementStatement(baseMatter(), [adjustment("a1", dollarsToCents(500), "SELLER")], newSettlementCosts());
    // Debited to seller means the buyer's mirrored entry is a CREDIT.
    expect(statement.buyer.balanceRequiredCents).toBe(dollarsToCents(84_500));
  });

  it("buyer costs increase the balance required", () => {
    const costs = newSettlementCosts();
    costs.buyer.transferDutyCents = dollarsToCents(30_000);
    costs.buyer.pexaFeeCents = dollarsToCents(150);
    const statement = buildSettlementStatement(baseMatter(), [], costs);
    expect(statement.buyer.balanceRequiredCents).toBe(dollarsToCents(85_000 + 30_000 + 150));
  });

  it("client funds credit the buyer, further reducing the balance required", () => {
    const statement = buildSettlementStatement(baseMatter({ clientFundsCents: dollarsToCents(10_000) }), [], newSettlementCosts());
    expect(statement.buyer.balanceRequiredCents).toBe(dollarsToCents(75_000));
  });
});

describe("buildSettlementStatement — seller formula", () => {
  it("net proceeds = price - mortgage payout - commission, with no adjustments", () => {
    const costs = newSettlementCosts();
    costs.seller.mortgagePayoutCents = dollarsToCents(400_000);
    costs.seller.commissionCents = dollarsToCents(18_000);
    const statement = buildSettlementStatement(baseMatter(), [], costs);
    expect(statement.seller.netProceedsCents).toBe(dollarsToCents(850_000 - 400_000 - 18_000));
  });

  it("a seller credit increases net proceeds", () => {
    const statement = buildSettlementStatement(baseMatter(), [adjustment("a1", dollarsToCents(500), "BUYER")], newSettlementCosts());
    // Debited to buyer means the seller's mirrored entry is a CREDIT.
    expect(statement.seller.netProceedsCents).toBe(dollarsToCents(850_500));
  });

  it("a seller debit decreases net proceeds", () => {
    const statement = buildSettlementStatement(baseMatter(), [adjustment("a1", dollarsToCents(500), "SELLER")], newSettlementCosts());
    expect(statement.seller.netProceedsCents).toBe(dollarsToCents(849_500));
  });

  it("mortgage payout is entered directly, never derived from a loan amount field", () => {
    // MatterDetails has no "original loan" field at all for the seller side —
    // this test exists to document that fact structurally: the seller formula
    // only ever reads costs.seller.mortgagePayoutCents.
    const costs = newSettlementCosts();
    costs.seller.mortgagePayoutCents = dollarsToCents(123_456);
    const statement = buildSettlementStatement(baseMatter(), [], costs);
    expect(statement.seller.netProceedsCents).toBe(dollarsToCents(850_000 - 123_456));
  });
});

describe("buildSettlementStatement — multi-adjustment realistic matter", () => {
  it("produces a fully self-consistent statement across several categories", () => {
    const results = [
      adjustment("rates1", dollarsToCents(195.65), "BUYER", "RATES"),
      adjustment("water1", dollarsToCents(60), "SELLER", "WATER"),
      adjustment("bc1", dollarsToCents(120), "BUYER", "BODY_CORPORATE"),
    ];
    const costs = newSettlementCosts();
    costs.buyer.transferDutyCents = dollarsToCents(28_000);
    costs.seller.commissionCents = dollarsToCents(17_000);
    const statement = buildSettlementStatement(baseMatter(), results, costs);

    expect(statement.balanceCheck.reconciles).toBe(true);
    // 85,000 (deposit-net) + 195.65 (buyer debit) - 60 (buyer credit) + 120 (buyer debit) + 28,000 (duty)
    expect(statement.buyer.balanceRequiredCents).toBe(
      dollarsToCents(85_000 + 195.65 - 60 + 120 + 28_000),
    );
  });
});

describe("buildSettlementStatement — balance check", () => {
  it("reconciles a correctly-mirrored set of adjustments", () => {
    const statement = buildSettlementStatement(baseMatter(), [adjustment("a1", dollarsToCents(500), "BUYER")], newSettlementCosts());
    expect(statement.balanceCheck.reconciles).toBe(true);
    expect(statement.balanceCheck.detail).toBe("");
  });

  it("flags a deliberately broken ledger — mismatched amounts", () => {
    const broken: AdjustmentCalculationResult = {
      id: "broken1",
      pending: false,
      messages: [],
      tier: "ok",
      automatic: null,
      override: null,
      effective: {
        source: "automatic",
        ledgerEntries: [
          { party: "BUYER", side: "DEBIT", amountCents: dollarsToCents(500), description: "x", sourceAdjustmentId: "broken1", category: "RATES" },
          { party: "SELLER", side: "CREDIT", amountCents: dollarsToCents(400), description: "x", sourceAdjustmentId: "broken1", category: "RATES" },
        ],
      },
    };
    const statement = buildSettlementStatement(baseMatter(), [broken], newSettlementCosts());
    expect(statement.balanceCheck.reconciles).toBe(false);
    expect(statement.balanceCheck.detail).toMatch(/don't agree on the amount/i);
  });

  it("flags a deliberately broken ledger — same party twice", () => {
    const broken: AdjustmentCalculationResult = {
      id: "broken2",
      pending: false,
      messages: [],
      tier: "ok",
      automatic: null,
      override: null,
      effective: {
        source: "automatic",
        ledgerEntries: [
          { party: "BUYER", side: "DEBIT", amountCents: dollarsToCents(500), description: "x", sourceAdjustmentId: "broken2", category: "RATES" },
          { party: "BUYER", side: "CREDIT", amountCents: dollarsToCents(500), description: "x", sourceAdjustmentId: "broken2", category: "RATES" },
        ],
      },
    };
    const statement = buildSettlementStatement(baseMatter(), [broken], newSettlementCosts());
    expect(statement.balanceCheck.reconciles).toBe(false);
    expect(statement.balanceCheck.detail).toMatch(/same party/i);
  });

  it("flags an unpaired single entry", () => {
    const broken: AdjustmentCalculationResult = {
      id: "broken3",
      pending: false,
      messages: [],
      tier: "ok",
      automatic: null,
      override: null,
      effective: {
        source: "automatic",
        ledgerEntries: [
          { party: "BUYER", side: "DEBIT", amountCents: dollarsToCents(500), description: "x", sourceAdjustmentId: "broken3", category: "RATES" },
        ],
      },
    };
    const statement = buildSettlementStatement(baseMatter(), [broken], newSettlementCosts());
    expect(statement.balanceCheck.reconciles).toBe(false);
    expect(statement.balanceCheck.detail).toMatch(/expected exactly 2/i);
  });
});

describe("buildSettlementStatement — missing required matter fields", () => {
  it("flags a missing settlement date at the statement level", () => {
    const statement = buildSettlementStatement(baseMatter({ settlementDate: null }), [], newSettlementCosts());
    expect(statement.messages.some((m) => m.tier === "error" && /settlement date/i.test(m.text))).toBe(true);
  });

  it("flags a missing contract price at the statement level", () => {
    const statement = buildSettlementStatement(baseMatter({ contractPriceCents: null }), [], newSettlementCosts());
    expect(statement.messages.some((m) => m.tier === "error" && /contract price/i.test(m.text))).toBe(true);
  });
});
