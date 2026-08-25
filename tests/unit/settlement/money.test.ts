/**
 * Integer-cents money arithmetic — the settlement calculator never does
 * financial arithmetic on floating-point dollars, so these tests exist to
 * prove that no float-drift rounding error is reachable no matter how many
 * operations a figure passes through.
 */

import { describe, expect, it } from "vitest";
import {
  addCents,
  centsToDollars,
  dollarsToCents,
  formatAUD,
  formatDollarsPlain,
  isNonNegative,
  multiplyCentsByRatio,
  negateCents,
  parseDollarStringToCents,
  subtractCents,
} from "@/lib/settlement/money";

describe("dollarsToCents / centsToDollars round-trip", () => {
  it("converts whole dollars", () => {
    expect(dollarsToCents(1200)).toBe(120_000);
    expect(centsToDollars(120_000)).toBe(1200);
  });

  it("converts cents", () => {
    expect(dollarsToCents(195.65)).toBe(19_565);
    expect(centsToDollars(19_565)).toBe(195.65);
  });

  it("converts large amounts without precision loss", () => {
    expect(dollarsToCents(1_875_000)).toBe(187_500_000);
  });

  it("is always an integer, even for a float-unfriendly input", () => {
    // 0.1 + 0.2 famously drifts in raw float arithmetic — dollarsToCents rounds it away.
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(Number.isInteger(dollarsToCents(0.1 + 0.2))).toBe(true);
  });
});

describe("addCents / subtractCents — integer exactness", () => {
  it("sums many small amounts without drift", () => {
    let total = 0;
    for (let i = 0; i < 1000; i++) total = addCents(total, 1); // 1000 x 1 cent
    expect(total).toBe(1000);
  });

  it("subtracts cleanly", () => {
    expect(subtractCents(100_00, 33_33)).toBe(66_67);
  });

  it("negates", () => {
    expect(negateCents(500)).toBe(-500);
  });
});

describe("multiplyCentsByRatio — proration rounding", () => {
  it("rounds once, at the end, not per intermediate step", () => {
    // $1,200.00 over 92 days: daily rate is 13.0434782... — never rounded mid-calculation.
    const amountCents = dollarsToCents(1200);
    const sellerDays = 15;
    const periodDays = 92;
    const sellerShare = multiplyCentsByRatio(amountCents, sellerDays, periodDays);
    expect(sellerShare).toBe(19_565); // matches the documented worked example: $195.65
  });

  it("is deterministic across repeated calls with the same inputs", () => {
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      results.add(multiplyCentsByRatio(dollarsToCents(1234.56), 37, 184));
    }
    expect(results.size).toBe(1);
  });

  it("returns 0 for a zero denominator rather than NaN/Infinity", () => {
    expect(multiplyCentsByRatio(1000, 5, 0)).toBe(0);
  });

  it("the remainder trick reconciles two shares back to the whole exactly", () => {
    const amountCents = dollarsToCents(1237.77);
    const periodDays = 92;
    const sellerDays = 37;
    const buyerDays = periodDays - sellerDays;
    const sellerShare = multiplyCentsByRatio(amountCents, sellerDays, periodDays);
    const buyerShare = subtractCents(amountCents, sellerShare);
    expect(addCents(sellerShare, buyerShare)).toBe(amountCents);
    // Sanity: buyerShare computed the "long way" should land within 1 cent of the remainder method.
    const buyerShareDirect = multiplyCentsByRatio(amountCents, buyerDays, periodDays);
    expect(Math.abs(buyerShare - buyerShareDirect)).toBeLessThanOrEqual(1);
  });
});

describe("formatAUD / formatDollarsPlain", () => {
  it("formats with thousands separators and the AUD symbol", () => {
    expect(formatAUD(dollarsToCents(850_000))).toBe("$850,000.00");
  });

  it("never displays a raw unformatted number", () => {
    const formatted = formatAUD(dollarsToCents(850_000));
    expect(formatted).not.toBe("850000");
    expect(formatted).toContain("$");
    expect(formatted).toContain(",");
  });

  it("formats null as an em dash", () => {
    expect(formatAUD(null)).toBe("—");
  });

  it("formats plain (no symbol) for the currency input's blur state", () => {
    expect(formatDollarsPlain(dollarsToCents(1234.5))).toBe("1,234.50");
    expect(formatDollarsPlain(null)).toBe("");
  });
});

describe("isNonNegative", () => {
  it("accepts zero and positive amounts", () => {
    expect(isNonNegative(0)).toBe(true);
    expect(isNonNegative(100)).toBe(true);
  });

  it("rejects negative amounts", () => {
    expect(isNonNegative(-1)).toBe(false);
  });
});

describe("parseDollarStringToCents", () => {
  it("parses a plain number", () => {
    expect(parseDollarStringToCents("1234.56")).toBe(123_456);
  });

  it("parses a comma-formatted number", () => {
    expect(parseDollarStringToCents("1,234.56")).toBe(123_456);
  });

  it("parses a whole-dollar string", () => {
    expect(parseDollarStringToCents("500")).toBe(50_000);
  });

  it("returns null for an empty string", () => {
    expect(parseDollarStringToCents("")).toBeNull();
    expect(parseDollarStringToCents("   ")).toBeNull();
  });

  it("returns null for invalid input rather than throwing", () => {
    expect(parseDollarStringToCents("abc")).toBeNull();
    expect(parseDollarStringToCents("12.3.4")).toBeNull();
    expect(parseDollarStringToCents("-50")).toBeNull();
  });

  it("returns null for more than two decimal places", () => {
    expect(parseDollarStringToCents("1.234")).toBeNull();
  });
});
