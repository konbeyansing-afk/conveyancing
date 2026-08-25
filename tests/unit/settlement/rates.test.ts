/**
 * Council Rates adjustment engine.
 */

import { describe, expect, it } from "vitest";
import { calculateRatesAdjustment, newRatesAdjustmentInput } from "@/lib/settlement/adjustments/rates";
import { dollarsToCents } from "@/lib/settlement/money";
import type { RatesAdjustmentInput } from "@/lib/settlement/adjustments/rates";

function readyInput(patch: Partial<RatesAdjustmentInput> = {}): RatesAdjustmentInput {
  return {
    ...newRatesAdjustmentInput("r1"),
    label: "General Rates",
    assessmentAmountCents: dollarsToCents(1200),
    periodStart: "2026-07-01",
    periodEnd: "2026-09-30", // 92 days
    noticeConfirmedCurrent: true,
    paymentStatus: "PAID_BY_SELLER",
    ...patch,
  };
}

describe("calculateRatesAdjustment — proration", () => {
  it("splits the assessment amount by settlement date, reconciling exactly", () => {
    const result = calculateRatesAdjustment(readyInput(), { settlementDate: "2026-07-15" });
    expect(result.tier).toBe("ok");
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Assessment days"]).toBe("92");
    expect(trail["Seller days (to and including settlement)"]).toBe("15");
    expect(trail["Buyer days (from day after settlement)"]).toBe("77");
  });

  it("buyer debit / seller credit when the seller already paid", () => {
    const result = calculateRatesAdjustment(
      readyInput({ paymentStatus: "PAID_BY_SELLER" }),
      { settlementDate: "2026-08-15" },
    );
    const entries = result.effective!.ledgerEntries;
    expect(entries.find((e) => e.party === "BUYER")?.side).toBe("DEBIT");
    expect(entries.find((e) => e.party === "SELLER")?.side).toBe("CREDIT");
    // Both entries carry the same amount (the buyer's share) — one debit, one mirrored credit.
    expect(entries[0].amountCents).toBe(entries[1].amountCents);
  });

  it("seller debit / buyer credit when not yet paid", () => {
    const result = calculateRatesAdjustment(
      readyInput({ paymentStatus: "NOT_YET_PAID" }),
      { settlementDate: "2026-08-15" },
    );
    const entries = result.effective!.ledgerEntries;
    expect(entries.find((e) => e.party === "SELLER")?.side).toBe("DEBIT");
    expect(entries.find((e) => e.party === "BUYER")?.side).toBe("CREDIT");
  });

  it("the seller's-paid adjustment (buyer's share) and the not-yet-paid adjustment (seller's share) sum to the whole assessment", () => {
    const paid = calculateRatesAdjustment(readyInput({ paymentStatus: "PAID_BY_SELLER" }), {
      settlementDate: "2026-08-03",
    });
    const notPaid = calculateRatesAdjustment(readyInput({ paymentStatus: "NOT_YET_PAID" }), {
      settlementDate: "2026-08-03",
    });
    // PAID_BY_SELLER settles the buyer's share; NOT_YET_PAID settles the seller's share —
    // together they always reconcile to the full $1,200 assessment amount.
    const total = paid.effective!.ledgerEntries[0].amountCents + notPaid.effective!.ledgerEntries[0].amountCents;
    expect(total).toBe(dollarsToCents(1200));
  });

  it("settlement on the first day of the period gives the seller a single day", () => {
    const result = calculateRatesAdjustment(readyInput(), { settlementDate: "2026-07-01" });
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Seller days (to and including settlement)"]).toBe("1");
  });

  it("settlement on the last day of the period gives the buyer zero days", () => {
    const result = calculateRatesAdjustment(readyInput(), { settlementDate: "2026-09-30" });
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Buyer days (from day after settlement)"]).toBe("0");
  });
});

describe("calculateRatesAdjustment — blocking errors", () => {
  it("blocks when the notice isn't confirmed current", () => {
    const result = calculateRatesAdjustment(readyInput({ noticeConfirmedCurrent: false }), {
      settlementDate: "2026-08-01",
    });
    expect(result.tier).toBe("error");
    expect(result.automatic).toBeNull();
  });

  it("blocks on a missing amount", () => {
    const result = calculateRatesAdjustment(readyInput({ assessmentAmountCents: null }), {
      settlementDate: "2026-08-01",
    });
    expect(result.tier).toBe("error");
  });

  it("blocks on a zero or negative amount", () => {
    expect(calculateRatesAdjustment(readyInput({ assessmentAmountCents: 0 }), { settlementDate: "2026-08-01" }).tier).toBe("error");
  });

  it("blocks on a missing period", () => {
    const result = calculateRatesAdjustment(readyInput({ periodStart: null }), { settlementDate: "2026-08-01" });
    expect(result.tier).toBe("error");
  });

  it("blocks when the period end is before the start", () => {
    const result = calculateRatesAdjustment(
      readyInput({ periodStart: "2026-09-30", periodEnd: "2026-07-01" }),
      { settlementDate: "2026-08-01" },
    );
    expect(result.tier).toBe("error");
  });

  it("blocks on a missing payment status", () => {
    const result = calculateRatesAdjustment(readyInput({ paymentStatus: null }), { settlementDate: "2026-08-01" });
    expect(result.tier).toBe("error");
  });

  it("blocks when there is no settlement date yet", () => {
    const result = calculateRatesAdjustment(readyInput(), { settlementDate: null });
    expect(result.tier).toBe("error");
  });
});

describe("calculateRatesAdjustment — warnings", () => {
  it("warns when settlement falls before the assessment period", () => {
    const result = calculateRatesAdjustment(readyInput(), { settlementDate: "2026-06-01" });
    expect(result.tier).toBe("warning");
    expect(result.messages.some((m) => /before this notice/i.test(m.text))).toBe(true);
  });

  it("warns when settlement falls after the assessment period", () => {
    const result = calculateRatesAdjustment(readyInput(), { settlementDate: "2026-12-01" });
    expect(result.tier).toBe("warning");
    expect(result.messages.some((m) => /after this notice/i.test(m.text))).toBe(true);
  });

  it("warns on a reference-figure mismatch without saying which is correct", () => {
    const result = calculateRatesAdjustment(
      readyInput({ referenceFigureCents: dollarsToCents(999) }),
      { settlementDate: "2026-08-15" },
    );
    expect(result.messages.some((m) => /doesn't reconcile/i.test(m.text))).toBe(true);
  });

  it("does not warn when the reference figure agrees", () => {
    const settlementDate = "2026-08-15";
    const automatic = calculateRatesAdjustment(readyInput(), { settlementDate }).effective!.ledgerEntries[0]
      .amountCents;
    const result = calculateRatesAdjustment(readyInput({ referenceFigureCents: automatic }), { settlementDate });
    expect(result.messages.some((m) => /doesn't reconcile/i.test(m.text))).toBe(false);
  });
});

describe("calculateRatesAdjustment — pending (notice not yet received)", () => {
  it("is pending and produces no result at all", () => {
    const result = calculateRatesAdjustment(readyInput({ noticeNotYetReceived: true }), {
      settlementDate: "2026-08-15",
    });
    expect(result.pending).toBe(true);
    expect(result.automatic).toBeNull();
    expect(result.effective).toBeNull();
  });
});

describe("calculateRatesAdjustment — manual override", () => {
  it("requires a reason when an override amount is entered", () => {
    const result = calculateRatesAdjustment(
      readyInput({ override: { enabled: true, amountCents: dollarsToCents(200), reason: "" } }),
      { settlementDate: "2026-08-15" },
    );
    expect(result.tier).toBe("error");
    expect(result.messages.some((m) => /reason is required/i.test(m.text))).toBe(true);
  });

  it("uses the override amount in `effective` while keeping the automatic figure in the trail", () => {
    const result = calculateRatesAdjustment(
      readyInput({
        override: { enabled: true, amountCents: dollarsToCents(200), reason: "Contract-specific adjustment." },
      }),
      { settlementDate: "2026-08-15" },
    );
    expect(result.effective!.source).toBe("override");
    expect(result.effective!.ledgerEntries[0].amountCents).toBe(dollarsToCents(200));
    expect(result.automatic).not.toBeNull(); // the calculated figure is still there for comparison
    expect(result.messages.some((m) => /manual override entered/i.test(m.text))).toBe(true);
  });

  it("override direction matches the automatic direction for the same payment status", () => {
    const result = calculateRatesAdjustment(
      readyInput({
        paymentStatus: "NOT_YET_PAID",
        override: { enabled: true, amountCents: dollarsToCents(50), reason: "Manual figure from agent." },
      }),
      { settlementDate: "2026-08-15" },
    );
    expect(result.effective!.ledgerEntries.find((e) => e.party === "SELLER")?.side).toBe("DEBIT");
  });
});
