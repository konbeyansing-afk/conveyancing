/**
 * Rent adjustment engine — arbitrary period + frequency, with the direction
 * logic flipped relative to the outgoing categories (rent is money flowing
 * IN, so "already collected by seller" credits the buyer, not the seller).
 */

import { describe, expect, it } from "vitest";
import { calculateRentAdjustment, newRentAdjustmentInput, type RentAdjustmentInput } from "@/lib/settlement/adjustments/rent";
import { dollarsToCents } from "@/lib/settlement/money";

function weeklyInput(patch: Partial<RentAdjustmentInput> = {}): RentAdjustmentInput {
  return {
    ...newRentAdjustmentInput("rent1"),
    rentAmountCents: dollarsToCents(700),
    frequency: "WEEKLY",
    periodStart: "2026-08-10", // Monday
    periodEnd: "2026-08-16", // Sunday — one full week, 7 days
    collectionStatus: "COLLECTED_BY_SELLER",
    ...patch,
  };
}

describe("calculateRentAdjustment — weekly", () => {
  it("splits a full week's rent by settlement date", () => {
    const result = calculateRentAdjustment(weeklyInput(), { settlementDate: "2026-08-12" });
    expect(result.tier).toBe("ok");
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Period days"]).toBe("7");
    expect(trail["Total rent for this period"]).toBe("$700.00");
  });

  it("seller debit / buyer credit when the seller already collected the rent", () => {
    const result = calculateRentAdjustment(weeklyInput({ collectionStatus: "COLLECTED_BY_SELLER" }), {
      settlementDate: "2026-08-12",
    });
    const entries = result.effective!.ledgerEntries;
    expect(entries.find((e) => e.party === "SELLER")?.side).toBe("DEBIT");
    expect(entries.find((e) => e.party === "BUYER")?.side).toBe("CREDIT");
  });

  it("buyer debit / seller credit when rent has not yet been collected", () => {
    const result = calculateRentAdjustment(weeklyInput({ collectionStatus: "NOT_YET_COLLECTED" }), {
      settlementDate: "2026-08-12",
    });
    const entries = result.effective!.ledgerEntries;
    expect(entries.find((e) => e.party === "BUYER")?.side).toBe("DEBIT");
    expect(entries.find((e) => e.party === "SELLER")?.side).toBe("CREDIT");
  });
});

describe("calculateRentAdjustment — fortnightly", () => {
  it("splits a fortnight's rent over 14 days", () => {
    const result = calculateRentAdjustment(
      weeklyInput({
        rentAmountCents: dollarsToCents(1400),
        frequency: "FORTNIGHTLY",
        periodStart: "2026-08-10",
        periodEnd: "2026-08-23", // 14 days
      }),
      { settlementDate: "2026-08-17" }, // exact midpoint-ish
    );
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Period days"]).toBe("14");
    expect(trail["Total rent for this period"]).toBe("$1,400.00");
  });
});

describe("calculateRentAdjustment — monthly does not assume a fixed 30-day month", () => {
  it("derives the daily rate from the real number of days in February (28)", () => {
    const result = calculateRentAdjustment(
      weeklyInput({
        rentAmountCents: dollarsToCents(2800),
        frequency: "MONTHLY",
        periodStart: "2026-02-01",
        periodEnd: "2026-02-28", // 28-day February, not a leap year
      }),
      { settlementDate: "2026-02-14" },
    );
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Days per cycle"]).toBe("28 (actual days in this calendar month)");
  });

  it("the same monthly rent amount implies a different daily rate in a 28-day month than a 31-day month", () => {
    // Same $3,100/month rent, same 10-day sub-period, settled on the period's
    // last day so the seller's share equals the whole period's rent — this
    // isolates exactly the "days per cycle" divisor the spec warns about.
    const feb = calculateRentAdjustment(
      weeklyInput({
        rentAmountCents: dollarsToCents(3100),
        frequency: "MONTHLY",
        periodStart: "2026-02-01",
        periodEnd: "2026-02-10", // 10 days of a 28-day February
        collectionStatus: "COLLECTED_BY_SELLER",
      }),
      { settlementDate: "2026-02-10" },
    );
    const jan = calculateRentAdjustment(
      weeklyInput({
        rentAmountCents: dollarsToCents(3100),
        frequency: "MONTHLY",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-10", // 10 days of a 31-day January
        collectionStatus: "COLLECTED_BY_SELLER",
      }),
      { settlementDate: "2026-01-10" },
    );
    const febTrail = Object.fromEntries(feb.automatic!.trail.map((t) => [t.label, t.value]));
    const janTrail = Object.fromEntries(jan.automatic!.trail.map((t) => [t.label, t.value]));
    // $3,100 x 10/28 = $1,107.14 (Feb); $3,100 x 10/31 = $1,000.00 (Jan) — same
    // amount, same sub-period length, genuinely different total because the
    // month lengths differ.
    expect(febTrail["Total rent for this period"]).toBe("$1,107.14");
    expect(janTrail["Total rent for this period"]).toBe("$1,000.00");
    expect(febTrail["Total rent for this period"]).not.toBe(janTrail["Total rent for this period"]);
  });

  it("handles a leap-year February (29 days)", () => {
    const result = calculateRentAdjustment(
      weeklyInput({
        rentAmountCents: dollarsToCents(2900),
        frequency: "MONTHLY",
        periodStart: "2028-02-01",
        periodEnd: "2028-02-29",
      }),
      { settlementDate: "2028-02-14" },
    );
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Days per cycle"]).toBe("29 (actual days in this calendar month)");
  });
});

describe("calculateRentAdjustment — validation", () => {
  it("blocks on a missing rent amount", () => {
    expect(calculateRentAdjustment(weeklyInput({ rentAmountCents: null }), { settlementDate: "2026-08-12" }).tier).toBe("error");
  });

  it("blocks on a missing frequency", () => {
    expect(calculateRentAdjustment(weeklyInput({ frequency: null }), { settlementDate: "2026-08-12" }).tier).toBe("error");
  });

  it("blocks on a missing collection status", () => {
    expect(calculateRentAdjustment(weeklyInput({ collectionStatus: null }), { settlementDate: "2026-08-12" }).tier).toBe("error");
  });
});
