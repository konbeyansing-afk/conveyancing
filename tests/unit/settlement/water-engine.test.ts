/**
 * Water engine additions: Arrears/Credit (a pre-existing balance, never
 * prorated, never auto-directed — same discipline as Land Tax) and
 * bill-total reconciliation across every water component on a matter. The
 * pre-existing FLAT/METERED calculation correctness is covered by
 * water.test.ts and is untouched here.
 */

import { describe, expect, it } from "vitest";
import {
  calculateWaterAdjustment,
  newWaterAdjustmentInput,
  reconcileWaterBillTotal,
  type WaterAdjustmentInput,
} from "@/lib/settlement/adjustments/water";
import { dollarsToCents } from "@/lib/settlement/money";
import type { AdjustmentCalculationResult } from "@/lib/settlement/types";

function arrearsInput(patch: Partial<WaterAdjustmentInput> = {}): WaterAdjustmentInput {
  return {
    ...newWaterAdjustmentInput("w-arrears", "ARREARS"),
    manualAmountCents: dollarsToCents(150),
    relatedParty: "SELLER",
    ...patch,
  };
}

function creditInput(patch: Partial<WaterAdjustmentInput> = {}): WaterAdjustmentInput {
  return {
    ...newWaterAdjustmentInput("w-credit", "CREDIT"),
    manualAmountCents: dollarsToCents(50),
    relatedParty: "SELLER",
    ...patch,
  };
}

describe("newWaterAdjustmentInput — component/mode defaults", () => {
  it("defaults ARREARS and CREDIT components to ARREARS_CREDIT mode", () => {
    expect(newWaterAdjustmentInput("a", "ARREARS").waterMode).toBe("ARREARS_CREDIT");
    expect(newWaterAdjustmentInput("b", "CREDIT").waterMode).toBe("ARREARS_CREDIT");
  });

  it("defaults every other component to FLAT mode", () => {
    expect(newWaterAdjustmentInput("c", "ACCESS_CHARGE").waterMode).toBe("FLAT");
    expect(newWaterAdjustmentInput("d", "SEWERAGE").waterMode).toBe("FLAT");
  });
});

describe("calculateWaterAdjustment — Arrears", () => {
  it("is never prorated — the full amount is the adjustment, regardless of any period", () => {
    const result = calculateWaterAdjustment(arrearsInput(), { settlementDate: "2026-09-15" });
    expect(result.tier).toBe("warning"); // the mandatory "confirm from the actual notice" warning always appears
    expect(result.effective!.ledgerEntries.every((e) => e.amountCents === dollarsToCents(150))).toBe(true);
  });

  it("debits the party specified as responsible", () => {
    const sellerOwes = calculateWaterAdjustment(arrearsInput({ relatedParty: "SELLER" }), { settlementDate: "2026-09-15" });
    expect(sellerOwes.effective!.ledgerEntries.find((e) => e.side === "DEBIT")?.party).toBe("SELLER");

    const buyerOwes = calculateWaterAdjustment(arrearsInput({ relatedParty: "BUYER" }), { settlementDate: "2026-09-15" });
    expect(buyerOwes.effective!.ledgerEntries.find((e) => e.side === "DEBIT")?.party).toBe("BUYER");
  });

  it("blocks on a missing amount", () => {
    const result = calculateWaterAdjustment(arrearsInput({ manualAmountCents: null }), { settlementDate: "2026-09-15" });
    expect(result.tier).toBe("error");
  });

  it("blocks on a missing responsible party — never assumed", () => {
    const result = calculateWaterAdjustment(arrearsInput({ relatedParty: null }), { settlementDate: "2026-09-15" });
    expect(result.tier).toBe("error");
    expect(result.messages.some((m) => /responsible/i.test(m.text))).toBe(true);
  });

  it("always carries the mandatory confirm-against-the-notice warning", () => {
    const result = calculateWaterAdjustment(arrearsInput(), { settlementDate: "2026-09-15" });
    expect(result.messages.some((m) => m.tier === "warning" && /confirm/i.test(m.text))).toBe(true);
  });
});

describe("calculateWaterAdjustment — Credit", () => {
  it("credits the named party — debits the other side", () => {
    const creditToSeller = calculateWaterAdjustment(creditInput({ relatedParty: "SELLER" }), { settlementDate: "2026-09-15" });
    expect(creditToSeller.effective!.ledgerEntries.find((e) => e.party === "SELLER")?.side).toBe("CREDIT");
    expect(creditToSeller.effective!.ledgerEntries.find((e) => e.party === "BUYER")?.side).toBe("DEBIT");

    const creditToBuyer = calculateWaterAdjustment(creditInput({ relatedParty: "BUYER" }), { settlementDate: "2026-09-15" });
    expect(creditToBuyer.effective!.ledgerEntries.find((e) => e.party === "BUYER")?.side).toBe("CREDIT");
    expect(creditToBuyer.effective!.ledgerEntries.find((e) => e.party === "SELLER")?.side).toBe("DEBIT");
  });

  it("is never turned into a positive charge — the ledger amount stays the entered credit amount, not negated or doubled", () => {
    const result = calculateWaterAdjustment(creditInput({ manualAmountCents: dollarsToCents(75) }), { settlementDate: "2026-09-15" });
    expect(result.effective!.ledgerEntries.every((e) => e.amountCents === dollarsToCents(75))).toBe(true);
  });

  it("blocks on a missing amount or party, same as arrears", () => {
    expect(calculateWaterAdjustment(creditInput({ manualAmountCents: null }), { settlementDate: "2026-09-15" }).tier).toBe("error");
    expect(calculateWaterAdjustment(creditInput({ relatedParty: null }), { settlementDate: "2026-09-15" }).tier).toBe("error");
  });
});

describe("calculateWaterAdjustment — Arrears/Credit manual override", () => {
  it("uses the override amount when enabled, same override mechanism as every other category", () => {
    const result = calculateWaterAdjustment(
      arrearsInput({ override: { enabled: true, amountCents: dollarsToCents(200), reason: "Confirmed against council letter" } }),
      { settlementDate: "2026-09-15" },
    );
    expect(result.effective!.source).toBe("override");
    expect(result.effective!.ledgerEntries[0].amountCents).toBe(dollarsToCents(200));
  });

  it("requires a reason for the override", () => {
    const result = calculateWaterAdjustment(
      arrearsInput({ override: { enabled: true, amountCents: dollarsToCents(200), reason: "" } }),
      { settlementDate: "2026-09-15" },
    );
    expect(result.messages.some((m) => /reason is required/i.test(m.text))).toBe(true);
  });
});

describe("reconcileWaterBillTotal", () => {
  function resultsFor(items: WaterAdjustmentInput[], settlementDate: string): Map<string, AdjustmentCalculationResult> {
    return new Map(items.map((i) => [i.id, calculateWaterAdjustment(i, { settlementDate })]));
  }

  it("returns null when no water item has a bill total entered — nothing to reconcile yet", () => {
    const items = [arrearsInput({ id: "w1" })];
    expect(reconcileWaterBillTotal(items, resultsFor(items, "2026-09-15"))).toBeNull();
  });

  it("reconciles when the sum of components matches the entered total", () => {
    const items = [
      arrearsInput({ id: "w1", manualAmountCents: dollarsToCents(100) }),
      creditInput({ id: "w2", manualAmountCents: dollarsToCents(20), billTotalCents: dollarsToCents(120) }),
    ];
    const reconciliation = reconcileWaterBillTotal(items, resultsFor(items, "2026-09-15"));
    expect(reconciliation!.reconciles).toBe(true);
    expect(reconciliation!.componentSumCents).toBe(dollarsToCents(120));
  });

  it("flags a mismatch, with the exact difference, rather than silently accepting either figure", () => {
    const items = [
      arrearsInput({ id: "w1", manualAmountCents: dollarsToCents(100) }),
      creditInput({ id: "w2", manualAmountCents: dollarsToCents(20), billTotalCents: dollarsToCents(150) }),
    ];
    const reconciliation = reconcileWaterBillTotal(items, resultsFor(items, "2026-09-15"));
    expect(reconciliation!.reconciles).toBe(false);
    expect(reconciliation!.differenceCents).toBe(dollarsToCents(30));
  });

  it("flags conflicting totals when two items disagree on what the notice's total actually is", () => {
    const items = [
      arrearsInput({ id: "w1", manualAmountCents: dollarsToCents(100), billTotalCents: dollarsToCents(100) }),
      creditInput({ id: "w2", manualAmountCents: dollarsToCents(20), billTotalCents: dollarsToCents(999) }),
    ];
    const reconciliation = reconcileWaterBillTotal(items, resultsFor(items, "2026-09-15"));
    expect(reconciliation!.conflictingTotals).toBe(true);
  });

  it("excludes an item that hasn't calculated yet (e.g. still has a validation error) from the sum", () => {
    const items = [
      arrearsInput({ id: "w1", manualAmountCents: null, billTotalCents: dollarsToCents(50) }), // errors — no effective amount
      creditInput({ id: "w2", manualAmountCents: dollarsToCents(50) }),
    ];
    const reconciliation = reconcileWaterBillTotal(items, resultsFor(items, "2026-09-15"));
    expect(reconciliation!.componentSumCents).toBe(dollarsToCents(50));
  });
});
