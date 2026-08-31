/**
 * Jurisdiction-aware settlement calculator terminology — purely a display
 * layer, never touching the calculation engine itself (see
 * jurisdiction-labels.ts's own comment on why only Body Corporate differs).
 */

import { describe, expect, it } from "vitest";
import { jurisdictionCategoryLabel } from "@/lib/settlement/jurisdiction-labels";
import { ADJUSTMENT_CATEGORY_LABEL, type AdjustmentCategory } from "@/lib/settlement/types";

describe("jurisdictionCategoryLabel", () => {
  it("uses NSW's Owners Corporation wording for Body Corporate on an NSW matter", () => {
    expect(jurisdictionCategoryLabel("NSW", "BODY_CORPORATE")).toBe("Owners Corporation (Strata)");
  });

  it("uses the standard Body Corporate wording on a QLD matter", () => {
    expect(jurisdictionCategoryLabel("QLD", "BODY_CORPORATE")).toBe("Body Corporate");
  });

  it("falls back to the standard wording when jurisdiction is null (the standalone practice tool)", () => {
    expect(jurisdictionCategoryLabel(null, "BODY_CORPORATE")).toBe("Body Corporate");
  });

  it("never relabels any other category — Council Rates, Water, Rent, Land Tax and Custom read the same in both states", () => {
    const otherCategories: AdjustmentCategory[] = ["RATES", "WATER", "RENT", "LAND_TAX", "CUSTOM"];
    for (const category of otherCategories) {
      expect(jurisdictionCategoryLabel("QLD", category)).toBe(ADJUSTMENT_CATEGORY_LABEL[category]);
      expect(jurisdictionCategoryLabel("NSW", category)).toBe(ADJUSTMENT_CATEGORY_LABEL[category]);
    }
  });
});
