/**
 * QLD settlement adjustment maths. These figures are what a trainee would be
 * checking against a PEXA settlement statement, so the arithmetic has to
 * reconcile exactly — seller's share plus buyer's share must equal the notice
 * to the cent, never a rounded approximation.
 */

import { describe, expect, it } from "vitest";
import {
  calculateSettlement,
  roundCents,
  type AdjustmentItemInput,
  type SettlementCalculationInput,
} from "@/lib/settlement-calculator";

const baseItem = (over: Partial<AdjustmentItemInput> = {}): AdjustmentItemInput => ({
  id: "i1",
  category: "RATES",
  label: "Council rates",
  amount: 1200,
  periodStart: "2026-07-01",
  periodEnd: "2026-12-31",
  noticeConfirmedCurrent: true,
  noticeNotYetReceived: false,
  paymentStatus: "PAID_BY_SELLER",
  pexaFigure: null,
  previousReadDate: null,
  previousReading: null,
  specialReadDate: null,
  specialReading: null,
  propertySharePercent: null,
  usageRatePerKL: null,
  accessCharge: null,
  ...over,
});

const input = (over: Partial<SettlementCalculationInput> = {}): SettlementCalculationInput => ({
  settlementDate: "2026-09-04",
  items: [baseItem()],
  contractPrice: null,
  depositPaid: null,
  ...over,
});

describe("roundCents", () => {
  it("rounds to two decimal places", () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(1.004)).toBe(1);
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe("Settlement adjustments — proration", () => {
  it("splits a paid rates notice by day and credits the seller the buyer's share", () => {
    const out = calculateSettlement(input());
    const r = out.results[0];

    // 1 July – 31 December 2026 inclusive is 184 days.
    expect(r.periodTotalDays).toBe(184);
    // 1 July – 4 September inclusive is 66 days.
    expect(r.sellerDays).toBe(66);
    expect(r.buyerDays).toBe(118);
    expect(r.creditTo).toBe("seller");
    expect(r.blockingErrors).toEqual([]);
  });

  it("reconciles seller's share plus buyer's share back to the notice exactly", () => {
    for (const amount of [1200, 999.99, 1234.56, 1000.01, 3333.33]) {
      const out = calculateSettlement(input({ items: [baseItem({ amount })] }));
      const r = out.results[0];
      expect(roundCents(r.sellerShare! + r.buyerShare!), `amount ${amount}`).toBe(
        roundCents(amount),
      );
    }
  });

  it("credits the buyer when the notice has not been paid", () => {
    const out = calculateSettlement(
      input({ items: [baseItem({ paymentStatus: "NOT_YET_PAID" })] }),
    );
    const r = out.results[0];
    expect(r.creditTo).toBe("buyer");
    // The buyer will pay the whole notice, so the seller owes their own days.
    expect(r.creditAmount).toBe(r.sellerShare);
  });

  it("credits the seller the buyer's share when the seller already paid", () => {
    const out = calculateSettlement(input({ items: [baseItem({ paymentStatus: "PAID_BY_SELLER" })] }));
    const r = out.results[0];
    expect(r.creditTo).toBe("seller");
    expect(r.creditAmount).toBe(r.buyerShare);
  });

  it("gives the seller the whole notice when settlement lands on the last day", () => {
    const out = calculateSettlement(
      input({ settlementDate: "2026-12-31", items: [baseItem({ paymentStatus: "NOT_YET_PAID" })] }),
    );
    const r = out.results[0];
    expect(r.sellerDays).toBe(184);
    expect(r.buyerDays).toBe(0);
    expect(r.buyerShare).toBe(0);
    expect(r.creditAmount).toBe(roundCents(1200));
  });

  it("gives the seller a single day when settlement is the first day of the period", () => {
    const out = calculateSettlement(input({ settlementDate: "2026-07-01" }));
    expect(out.results[0].sellerDays).toBe(1);
    expect(out.results[0].buyerDays).toBe(183);
  });
});

describe("Settlement adjustments — refusing to calculate on bad input", () => {
  it("blocks until the notice is confirmed current", () => {
    const out = calculateSettlement(
      input({ items: [baseItem({ noticeConfirmedCurrent: false })] }),
    );
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/current/i);
    expect(out.results[0].creditAmount).toBeNull();
  });

  it("blocks on a missing amount rather than assuming zero", () => {
    const out = calculateSettlement(input({ items: [baseItem({ amount: null })] }));
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/notice amount/i);
    expect(out.results[0].creditAmount).toBeNull();
  });

  it("blocks on a negative or zero amount", () => {
    for (const amount of [0, -50]) {
      const out = calculateSettlement(input({ items: [baseItem({ amount })] }));
      expect(out.results[0].blockingErrors.length, `amount ${amount}`).toBeGreaterThan(0);
    }
  });

  it("blocks on a missing period", () => {
    const out = calculateSettlement(input({ items: [baseItem({ periodEnd: null })] }));
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/period/i);
  });

  it("blocks when the period end precedes the start", () => {
    const out = calculateSettlement(
      input({ items: [baseItem({ periodStart: "2026-12-31", periodEnd: "2026-07-01" })] }),
    );
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/before the start/i);
  });

  it("blocks until the payment status is known, since it sets the credit direction", () => {
    const out = calculateSettlement(input({ items: [baseItem({ paymentStatus: null })] }));
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/already been paid/i);
    expect(out.results[0].creditTo).toBeNull();
  });

  it("reports a missing settlement date at the top level", () => {
    const out = calculateSettlement(input({ settlementDate: null }));
    expect(out.settlementDateError).toMatch(/settlement date/i);
    expect(out.results[0].creditAmount).toBeNull();
    // The daily rate is still useful, so it is still shown.
    expect(out.results[0].dailyRate).not.toBeNull();
  });

  it("treats a not-yet-received notice as pending, not as zero", () => {
    const out = calculateSettlement(
      input({ items: [baseItem({ noticeNotYetReceived: true, amount: null })] }),
    );
    expect(out.results[0].pending).toBe(true);
    expect(out.results[0].blockingErrors).toEqual([]);
    expect(out.results[0].creditAmount).toBeNull();
    expect(out.totalCreditToBuyer).toBe(0);
    expect(out.totalCreditToSeller).toBe(0);
  });
});

describe("Settlement adjustments — warnings that need a human", () => {
  it("warns when settlement falls outside the notice period", () => {
    const before = calculateSettlement(input({ settlementDate: "2026-06-01" }));
    expect(before.results[0].warnings.join(" ")).toMatch(/before this notice's period/i);
    expect(before.results[0].creditAmount).toBeNull();

    const after = calculateSettlement(input({ settlementDate: "2027-01-15" }));
    expect(after.results[0].warnings.join(" ")).toMatch(/after this notice's period/i);
    expect(after.results[0].creditAmount).toBeNull();
  });

  it("warns rather than silently deferring when the PEXA figure disagrees", () => {
    const out = calculateSettlement(input({ items: [baseItem({ pexaFigure: 1 })] }));
    expect(out.results[0].warnings.join(" ")).toMatch(/reconcile/i);
    // It still reports its own figure — it does not adopt PEXA's.
    expect(out.results[0].creditAmount).not.toBe(1);
  });

  it("does not warn when the PEXA figure agrees to the cent", () => {
    const first = calculateSettlement(input());
    const agreed = calculateSettlement(
      input({ items: [baseItem({ pexaFigure: first.results[0].creditAmount })] }),
    );
    expect(agreed.results[0].warnings.join(" ")).not.toMatch(/reconcile/i);
  });

  it("warns about two notices for the same thing that overlap", () => {
    const out = calculateSettlement(
      input({
        items: [
          baseItem({ id: "a", periodStart: "2026-07-01", periodEnd: "2026-12-31" }),
          baseItem({ id: "b", periodStart: "2026-10-01", periodEnd: "2027-03-31" }),
        ],
      }),
    );
    expect(out.results.flatMap((r) => r.warnings).join(" ")).toMatch(/overlaps/i);
  });

  it("warns about a gap between consecutive notices for the same thing", () => {
    const out = calculateSettlement(
      input({
        items: [
          baseItem({ id: "a", periodStart: "2026-01-01", periodEnd: "2026-06-30" }),
          baseItem({ id: "b", periodStart: "2026-08-01", periodEnd: "2026-12-31" }),
        ],
      }),
    );
    expect(out.results.flatMap((r) => r.warnings).join(" ")).toMatch(/gap/i);
  });

  it("keeps different categories apart when looking for overlaps", () => {
    const out = calculateSettlement(
      input({
        items: [
          baseItem({ id: "a", category: "RATES", label: "Council rates" }),
          baseItem({ id: "b", category: "WATER", label: "Water access" }),
        ],
      }),
    );
    expect(out.results.flatMap((r) => r.warnings).join(" ")).not.toMatch(/overlaps/i);
  });
});

describe("Settlement adjustments — metered water", () => {
  const metered = (over: Partial<AdjustmentItemInput> = {}) =>
    baseItem({
      id: "w1",
      category: "WATER",
      waterMode: "METERED",
      label: "Water usage",
      amount: null,
      periodStart: null,
      periodEnd: null,
      paymentStatus: null,
      previousReadDate: "2026-05-01",
      previousReading: 100,
      specialReadDate: "2026-08-30",
      specialReading: 160,
      propertySharePercent: 100,
      usageRatePerKL: 4,
      accessCharge: 60,
      ...over,
    });

  it("estimates unbilled usage and credits the buyer", () => {
    const out = calculateSettlement(input({ items: [metered()] }));
    const r = out.results[0];

    // 121 days between reads, 60 kL used → 495.87 L/day, extended over the
    // 5-day gap to settlement.
    expect(r.creditTo).toBe("buyer");
    expect(r.meteredAvgDailyUsageL).toBe(496);
    expect(r.meteredTotalUsageKL).toBeGreaterThan(60);
    expect(r.meteredUsageCharge).toBeGreaterThan(240);
    expect(r.meteredAccessCharge).toBe(60);
    expect(r.creditAmount).toBe(roundCents(r.meteredUsageCharge! + r.meteredAccessCharge!));
  });

  it("applies the property's share of a shared meter", () => {
    const full = calculateSettlement(input({ items: [metered()] })).results[0];
    const half = calculateSettlement(
      input({ items: [metered({ propertySharePercent: 50 })] }),
    ).results[0];
    expect(half.meteredTotalUsageKL).toBeCloseTo(full.meteredTotalUsageKL! / 2, 3);
  });

  it("treats a meter that went backwards as zero usage and says so", () => {
    const out = calculateSettlement(input({ items: [metered({ specialReading: 40 })] }));
    expect(out.results[0].warnings.join(" ")).toMatch(/meter reset|lower than/i);
    expect(out.results[0].meteredTotalUsageKL).toBe(0);
  });

  it("blocks until the readings are confirmed against the notice", () => {
    const out = calculateSettlement(
      input({ items: [metered({ noticeConfirmedCurrent: false })] }),
    );
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/search certificate|notice/i);
  });

  it("blocks on a missing usage rate rather than assuming one", () => {
    const out = calculateSettlement(input({ items: [metered({ usageRatePerKL: null })] }));
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/usage rate/i);
    expect(out.results[0].creditAmount).toBeNull();
  });

  it("blocks when the reads are the same day", () => {
    const out = calculateSettlement(
      input({ items: [metered({ specialReadDate: "2026-05-01" })] }),
    );
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/must be different/i);
  });

  it("blocks when the special read precedes the previous read", () => {
    const out = calculateSettlement(
      input({ items: [metered({ specialReadDate: "2026-04-01" })] }),
    );
    expect(out.results[0].blockingErrors.join(" ")).toMatch(/before the previous read/i);
  });

  it("warns rather than extrapolating backwards when settlement precedes the special read", () => {
    const out = calculateSettlement(
      input({ settlementDate: "2026-08-01", items: [metered()] }),
    );
    expect(out.results[0].warnings.join(" ")).toMatch(/before the special meter read/i);
    expect(out.results[0].creditAmount).toBeNull();
  });

  it("rejects a property share outside 1–100", () => {
    for (const share of [0, -5, 101]) {
      const out = calculateSettlement(input({ items: [metered({ propertySharePercent: share })] }));
      expect(out.results[0].blockingErrors.join(" "), `share ${share}`).toMatch(/property share/i);
    }
  });
});

describe("Settlement adjustments — totals and balance purchase price", () => {
  it("nets credits in both directions", () => {
    const out = calculateSettlement(
      input({
        items: [
          baseItem({ id: "a", paymentStatus: "PAID_BY_SELLER" }),
          baseItem({
            id: "b",
            label: "Water access",
            category: "WATER",
            amount: 300,
            paymentStatus: "NOT_YET_PAID",
          }),
        ],
      }),
    );
    expect(out.totalCreditToSeller).toBeGreaterThan(0);
    expect(out.totalCreditToBuyer).toBeGreaterThan(0);
    expect(out.netToBuyer).toBe(roundCents(out.totalCreditToBuyer - out.totalCreditToSeller));
  });

  it("computes the balance purchase price from price, deposit and net adjustment", () => {
    const out = calculateSettlement(
      input({ contractPrice: 850000, depositPaid: 85000 }),
    );
    expect(out.balanceUnavailableReason).toBeNull();
    expect(out.balancePurchasePrice).toBe(roundCents(850000 - 85000 - out.netToBuyer));
  });

  it("says why the balance cannot be produced rather than guessing", () => {
    const out = calculateSettlement(input({ contractPrice: 850000, depositPaid: null }));
    expect(out.balancePurchasePrice).toBeNull();
    expect(out.balanceUnavailableReason).toMatch(/contract price and deposit/i);
  });

  it("produces no totals at all when nothing can be calculated", () => {
    const out = calculateSettlement(
      input({ items: [baseItem({ noticeConfirmedCurrent: false })] }),
    );
    expect(out.totalCreditToBuyer).toBe(0);
    expect(out.totalCreditToSeller).toBe(0);
    expect(out.netToBuyer).toBe(0);
  });

  it("handles an empty adjustment list without throwing", () => {
    const out = calculateSettlement(input({ items: [] }));
    expect(out.results).toEqual([]);
    expect(out.netToBuyer).toBe(0);
  });
});
