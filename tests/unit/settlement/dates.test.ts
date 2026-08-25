/**
 * Date engine — the settlement calculator's inclusive/exclusive convention
 * (documented in dates.ts) has to hold under leap years and arbitrary
 * period boundaries, since every adjustment category's proration depends on
 * it being exactly right.
 */

import { describe, expect, it } from "vitest";
import {
  addDays,
  compareIsoDates,
  daysInMonth,
  daysInMonthOf,
  daysExclusive,
  daysInclusive,
  formatAuDate,
  formatLongAuDate,
  isLeapYear,
  isValidIsoDate,
  parseIsoDate,
} from "@/lib/settlement/dates";

describe("isValidIsoDate", () => {
  it("accepts a well-formed date", () => {
    expect(isValidIsoDate("2026-08-25")).toBe(true);
  });

  it("rejects null, undefined and empty", () => {
    expect(isValidIsoDate(null)).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });

  it("rejects a malformed string", () => {
    expect(isValidIsoDate("25/08/2026")).toBe(false);
    expect(isValidIsoDate("2026-8-25")).toBe(false);
    expect(isValidIsoDate("not a date")).toBe(false);
  });

  it("rejects a calendar-invalid date", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
  });
});

describe("daysInclusive / daysExclusive", () => {
  it("counts the same day as 1 day inclusive, 0 exclusive", () => {
    expect(daysInclusive("2026-07-01", "2026-07-01")).toBe(1);
    expect(daysExclusive("2026-07-01", "2026-07-01")).toBe(0);
  });

  it("counts a normal-year period correctly", () => {
    // 1 Jul – 30 Sep inclusive = 92 days (31 + 31 + 30).
    expect(daysInclusive("2026-07-01", "2026-09-30")).toBe(92);
  });

  it("is negative when b is before a", () => {
    expect(daysInclusive("2026-09-30", "2026-07-01")).toBeLessThan(0);
  });
});

describe("isLeapYear", () => {
  it("2024 and 2028 are leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2028)).toBe(true);
  });

  it("2025 and 2026 are not leap years", () => {
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
  });

  it("1900 is not a leap year (divisible by 100, not 400)", () => {
    expect(isLeapYear(1900)).toBe(false);
  });

  it("2000 is a leap year (divisible by 400)", () => {
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe("a rates period spanning 29 February in a leap year", () => {
  it("counts the leap day itself", () => {
    // 2028 is a leap year; Feb has 29 days.
    expect(daysInclusive("2028-02-28", "2028-02-29")).toBe(2);
    expect(daysInclusive("2028-02-01", "2028-02-29")).toBe(29);
  });

  it("a full-quarter period including Feb is one day longer in a leap year", () => {
    const leapQuarter = daysInclusive("2028-01-01", "2028-03-31"); // 31+29+31
    const normalQuarter = daysInclusive("2026-01-01", "2026-03-31"); // 31+28+31
    expect(leapQuarter).toBe(normalQuarter + 1);
  });
});

describe("daysInMonth / daysInMonthOf", () => {
  it("returns 28 for February in a non-leap year", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("returns 29 for February in a leap year", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it("returns 31 for a 31-day month", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("daysInMonthOf reads the month off the given date", () => {
    expect(daysInMonthOf("2026-01-15")).toBe(31);
    expect(daysInMonthOf("2026-02-15")).toBe(28);
  });
});

describe("addDays", () => {
  it("adds within a month", () => {
    expect(addDays("2026-08-01", 10)).toBe("2026-08-11");
  });

  it("rolls over a month boundary", () => {
    expect(addDays("2026-08-25", 10)).toBe("2026-09-04");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("2026-12-28", 5)).toBe("2027-01-02");
  });

  it("handles a leap-year February correctly", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("subtracts with a negative count", () => {
    expect(addDays("2026-08-05", -10)).toBe("2026-07-26");
  });
});

describe("compareIsoDates", () => {
  it("orders dates correctly", () => {
    expect(compareIsoDates("2026-08-01", "2026-08-02")).toBe(-1);
    expect(compareIsoDates("2026-08-02", "2026-08-01")).toBe(1);
    expect(compareIsoDates("2026-08-01", "2026-08-01")).toBe(0);
  });
});

describe("formatting", () => {
  it("formats as dd/mm/yyyy", () => {
    expect(formatAuDate("2026-08-25")).toBe("25/08/2026");
  });

  it("formats invalid/null as an em dash", () => {
    expect(formatAuDate(null)).toBe("—");
    expect(formatAuDate("not-a-date")).toBe("—");
  });

  it("formats a long-form Australian date", () => {
    expect(formatLongAuDate("2026-10-03")).toBe("3 October 2026");
  });
});

describe("parseIsoDate", () => {
  it("parses at UTC midnight, unaffected by local timezone", () => {
    const d = parseIsoDate("2026-08-25");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7); // 0-indexed
    expect(d.getUTCDate()).toBe(25);
    expect(d.getUTCHours()).toBe(0);
  });
});
