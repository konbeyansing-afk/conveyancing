/**
 * Bridges the UI's stored adjustment items to the pure per-category engines.
 * Written once here so every component that needs "all current adjustment
 * results" (the list, the summary, the statement, the warnings panel) calls
 * the same function rather than re-deriving the category switch itself.
 */

import { calculateBodyCorporateAdjustment } from "./adjustments/bodyCorporate";
import { calculateCustomAdjustment } from "./adjustments/custom";
import { calculateLandTaxAdjustment } from "./adjustments/landTax";
import { calculateRatesAdjustment } from "./adjustments/rates";
import { calculateRentAdjustment } from "./adjustments/rent";
import { calculateWaterAdjustment } from "./adjustments/water";
import type { IsoDate } from "./dates";
import type { SettlementAdjustmentItem } from "./store";
import type { AdjustmentCalculationResult } from "./types";

export function computeAdjustmentResults(
  adjustments: SettlementAdjustmentItem[],
  ctx: { settlementDate: IsoDate | null },
): AdjustmentCalculationResult[] {
  return adjustments.map((item) => {
    switch (item.category) {
      case "RATES":
        return calculateRatesAdjustment(item.input, ctx);
      case "WATER":
        return calculateWaterAdjustment(item.input, ctx);
      case "BODY_CORPORATE":
        return calculateBodyCorporateAdjustment(item.input, ctx);
      case "RENT":
        return calculateRentAdjustment(item.input, ctx);
      case "LAND_TAX":
        return calculateLandTaxAdjustment(item.input);
      case "CUSTOM":
        return calculateCustomAdjustment(item.input);
    }
  });
}
