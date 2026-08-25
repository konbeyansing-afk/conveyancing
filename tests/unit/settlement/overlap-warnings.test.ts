/**
 * Overlap/gap detection across same-category+label period items, and the
 * PEXA-style figure-reconciliation helper — both shared by every adjustment
 * category that has an assessment period, so they're tested once here.
 */

import { describe, expect, it } from "vitest";
import { dollarsToCents } from "@/lib/settlement/money";
import {
  findOverlapsAndGaps,
  reconcileAgainstFigure,
  worstTier,
  type PeriodItem,
} from "@/lib/settlement/warnings";

describe("findOverlapsAndGaps", () => {
  it("warns on overlapping periods for the same category+label", () => {
    const items: PeriodItem[] = [
      { id: "a", category: "RATES", label: "Rates", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      { id: "b", category: "RATES", label: "Rates", periodStart: "2026-09-15", periodEnd: "2026-12-31" },
    ];
    const result = findOverlapsAndGaps(items);
    expect(result.get("a")?.[0].text).toMatch(/overlaps/i);
    expect(result.get("b")?.[0].text).toMatch(/overlaps/i);
  });

  it("warns on a gap between consecutive periods", () => {
    const items: PeriodItem[] = [
      { id: "a", category: "RATES", label: "Rates", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      { id: "b", category: "RATES", label: "Rates", periodStart: "2026-10-05", periodEnd: "2026-12-31" },
    ];
    const result = findOverlapsAndGaps(items);
    expect(result.get("a")).toBeUndefined();
    expect(result.get("b")?.[0].text).toMatch(/gap/i);
    expect(result.get("b")?.[0].text).toContain("4-day");
  });

  it("does not warn on back-to-back periods with no gap", () => {
    const items: PeriodItem[] = [
      { id: "a", category: "RATES", label: "Rates", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      { id: "b", category: "RATES", label: "Rates", periodStart: "2026-10-01", periodEnd: "2026-12-31" },
    ];
    expect(findOverlapsAndGaps(items).size).toBe(0);
  });

  it("keeps different categories apart", () => {
    const items: PeriodItem[] = [
      { id: "a", category: "RATES", label: "Rates", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      { id: "b", category: "WATER", label: "Water", periodStart: "2026-09-15", periodEnd: "2026-12-31" },
    ];
    expect(findOverlapsAndGaps(items).size).toBe(0);
  });

  it("keeps different labels within the same category apart (e.g. admin fund vs sinking fund)", () => {
    const items: PeriodItem[] = [
      { id: "a", category: "BODY_CORPORATE", label: "Admin Fund", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      { id: "b", category: "BODY_CORPORATE", label: "Sinking Fund", periodStart: "2026-09-15", periodEnd: "2026-12-31" },
    ];
    expect(findOverlapsAndGaps(items).size).toBe(0);
  });

  it("excludes items flagged excludeFromOverlapCheck", () => {
    const items: PeriodItem[] = [
      { id: "a", category: "RATES", label: "Rates", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      { id: "b", category: "RATES", label: "Rates", periodStart: null, periodEnd: null, excludeFromOverlapCheck: true },
    ];
    expect(findOverlapsAndGaps(items).size).toBe(0);
  });

  it("ignores items with invalid or missing dates", () => {
    const items: PeriodItem[] = [
      { id: "a", category: "RATES", label: "Rates", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      { id: "b", category: "RATES", label: "Rates", periodStart: null, periodEnd: null },
    ];
    expect(findOverlapsAndGaps(items).size).toBe(0);
  });

  it("returns nothing for a single item", () => {
    const items: PeriodItem[] = [
      { id: "a", category: "RATES", label: "Rates", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
    ];
    expect(findOverlapsAndGaps(items).size).toBe(0);
  });
});

describe("reconcileAgainstFigure", () => {
  it("returns null when there is no entered figure to check against", () => {
    expect(reconcileAgainstFigure(dollarsToCents(100), null, "PEXA")).toBeNull();
  });

  it("returns null when the figures agree exactly", () => {
    expect(reconcileAgainstFigure(dollarsToCents(100), dollarsToCents(100), "PEXA")).toBeNull();
  });

  it("warns when the figures disagree, without saying which is correct", () => {
    const msg = reconcileAgainstFigure(dollarsToCents(100), dollarsToCents(100.5), "PEXA");
    expect(msg?.tier).toBe("warning");
    expect(msg?.text).toContain("$100.00");
    expect(msg?.text).toContain("$100.50");
    expect(msg?.text).toMatch(/flag for review/i);
  });
});

describe("worstTier", () => {
  it("returns ok for an empty list", () => {
    expect(worstTier([])).toBe("ok");
  });

  it("prioritises error over warning over info", () => {
    expect(worstTier([{ tier: "info", text: "" }, { tier: "warning", text: "" }])).toBe("warning");
    expect(worstTier([{ tier: "warning", text: "" }, { tier: "error", text: "" }])).toBe("error");
    expect(worstTier([{ tier: "info", text: "" }])).toBe("info");
  });
});
