/**
 * Jurisdiction-aware display terminology for the settlement calculator.
 *
 * Deliberately thin: the calculation engine (adjustments/*, statement.ts,
 * ledger.ts, dates.ts, money.ts) is jurisdiction-agnostic day-based
 * proration arithmetic and stays completely untouched — nothing here
 * changes a number, only a label. Council Rates, Water, Rent, Land Tax and
 * Custom Adjustment already use the same term in ordinary QLD and NSW
 * conveyancing usage, so only Body Corporate needs an override: NSW's
 * Strata Schemes Management Act calls the equivalent body an "Owners
 * Corporation" (still commonly called "strata" day to day), where QLD's
 * Body Corporate and Community Management Act calls it a "Body Corporate".
 *
 * Land tax and any other genuinely state-specific *rule* (thresholds,
 * whether it's adjusted at all) is deliberately NOT encoded here or
 * anywhere in the engine — see adjustments/landTax.ts's own comment: that
 * module never calculates automatically, it only ever records what the
 * user confirms against the actual contract, with a mandatory warning.
 * That discipline is exactly right and is left exactly as it was.
 */

import type { Jurisdiction } from "@prisma/client";
import { ADJUSTMENT_CATEGORY_LABEL, type AdjustmentCategory } from "./types";

export function jurisdictionCategoryLabel(
  jurisdiction: Jurisdiction | null,
  category: AdjustmentCategory,
): string {
  if (category === "BODY_CORPORATE" && jurisdiction === "NSW") {
    return "Owners Corporation (Strata)";
  }
  return ADJUSTMENT_CATEGORY_LABEL[category];
}
