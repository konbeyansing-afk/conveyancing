/**
 * Water adjustment engine — FLAT mode (identical shape to rates) and
 * METERED mode (real usage estimated from a previous read + special read,
 * never invented). Worked numbers verified by hand against the previous
 * implementation's own tested fixture (100->160 kL, 1 May - 30 Aug 2026,
 * settlement 4 Sep 2026, $4.00/kL, $60 access charge).
 */

import { describe, expect, it } from "vitest";
import {
  calculateWaterAdjustment,
  newWaterAdjustmentInput,
  type WaterAdjustmentInput,
} from "@/lib/settlement/adjustments/water";
import { dollarsToCents } from "@/lib/settlement/money";

function flatInput(patch: Partial<WaterAdjustmentInput> = {}): WaterAdjustmentInput {
  return {
    ...newWaterAdjustmentInput("w1", "ACCESS_CHARGE"),
    waterMode: "FLAT",
    label: "Water access",
    amountCents: dollarsToCents(300),
    periodStart: "2026-07-01",
    periodEnd: "2026-09-30",
    noticeConfirmedCurrent: true,
    paymentStatus: "PAID_BY_SELLER",
    ...patch,
  };
}

function meteredInput(patch: Partial<WaterAdjustmentInput> = {}): WaterAdjustmentInput {
  return {
    ...newWaterAdjustmentInput("w2", "USAGE"),
    waterMode: "METERED",
    label: "Water usage",
    noticeConfirmedCurrent: true,
    previousReadDate: "2026-05-01",
    previousReadingKL: 100,
    specialReadDate: "2026-08-30",
    specialReadingKL: 160,
    propertySharePercent: 100,
    usageRatePerKLCents: dollarsToCents(4),
    fixedAccessChargeCents: dollarsToCents(60),
    ...patch,
  };
}

describe("calculateWaterAdjustment — flat mode", () => {
  it("prorates like a rates notice", () => {
    const result = calculateWaterAdjustment(flatInput(), { settlementDate: "2026-08-15" });
    expect(result.tier).toBe("ok");
    expect(result.automatic).not.toBeNull();
  });

  it("blocks on a missing amount", () => {
    expect(calculateWaterAdjustment(flatInput({ amountCents: null }), { settlementDate: "2026-08-15" }).tier).toBe("error");
  });
});

describe("calculateWaterAdjustment — metered mode", () => {
  it("estimates unbilled usage and produces a buyer credit", () => {
    const result = calculateWaterAdjustment(meteredInput(), { settlementDate: "2026-09-04" });
    expect(result.tier).toBe("ok");
    const entries = result.effective!.ledgerEntries;
    expect(entries.find((e) => e.party === "SELLER")?.side).toBe("DEBIT");
    expect(entries.find((e) => e.party === "BUYER")?.side).toBe("CREDIT");
    // Verified by hand: 121-day read period, 496 L/day average, 5-day gap to
    // settlement -> $249.92 usage + $60.00 access = $309.92.
    expect(entries[0].amountCents).toBe(dollarsToCents(309.92));
  });

  it("computes the average daily usage rate from the read period", () => {
    const result = calculateWaterAdjustment(meteredInput(), { settlementDate: "2026-09-04" });
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Average daily usage"]).toBe("496 L/day");
  });

  it("applies the property's share of a shared meter", () => {
    const full = calculateWaterAdjustment(meteredInput(), { settlementDate: "2026-09-04" });
    const half = calculateWaterAdjustment(meteredInput({ propertySharePercent: 50 }), { settlementDate: "2026-09-04" });
    // Half the usage -> roughly half the usage charge (access charge is unaffected by share).
    const fullUsagePortion = full.effective!.ledgerEntries[0].amountCents - dollarsToCents(60);
    const halfUsagePortion = half.effective!.ledgerEntries[0].amountCents - dollarsToCents(60);
    expect(halfUsagePortion).toBeCloseTo(fullUsagePortion / 2, -1);
  });

  it("treats a meter that reads backwards as zero usage, with a warning", () => {
    const result = calculateWaterAdjustment(meteredInput({ specialReadingKL: 40 }), { settlementDate: "2026-09-04" });
    expect(result.messages.some((m) => /meter reset or replacement/i.test(m.text))).toBe(true);
  });

  it("blocks when the notice isn't confirmed against the readings", () => {
    expect(calculateWaterAdjustment(meteredInput({ noticeConfirmedCurrent: false }), { settlementDate: "2026-09-04" }).tier).toBe("error");
  });

  it("blocks on a missing usage rate rather than assuming a water authority's current rate", () => {
    const result = calculateWaterAdjustment(meteredInput({ usageRatePerKLCents: null }), { settlementDate: "2026-09-04" });
    expect(result.tier).toBe("error");
    expect(result.messages.some((m) => /never assumes/i.test(m.text))).toBe(true);
  });

  it("blocks when the special read is before the previous read", () => {
    const result = calculateWaterAdjustment(meteredInput({ specialReadDate: "2026-04-01" }), { settlementDate: "2026-09-04" });
    expect(result.tier).toBe("error");
  });

  it("warns when settlement is before the special read date", () => {
    const result = calculateWaterAdjustment(meteredInput(), { settlementDate: "2026-08-01" });
    expect(result.messages.some((m) => /before the special meter read/i.test(m.text))).toBe(true);
  });

  it("is pending when the notice hasn't been received", () => {
    const result = calculateWaterAdjustment(meteredInput({ noticeNotYetReceived: true }), { settlementDate: "2026-09-04" });
    expect(result.pending).toBe(true);
  });
});
