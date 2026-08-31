"use client";

/**
 * A finalised (or any) calculation's numbers, read-only — used for the
 * "open a previous version" history view (spec section 21). Only the
 * output-only components (CalculationSummary, SettlementStatementView)
 * are rendered here, not the editable input sections (AdjustmentList,
 * MatterSetupSection, SettlementCostsSection) — there is nothing to edit
 * on a past version, so `dispatch` is a no-op rather than wired to
 * anything that could mutate it.
 */

import { SettlementContext } from "@/lib/settlement/context";
import { CalculationSummary } from "./calculation-summary";
import { SettlementStatementView } from "./settlement-statement";
import type { SettlementState } from "@/lib/settlement/state";

export function ReadOnlySettlementView({ state }: { state: SettlementState }) {
  return (
    <SettlementContext.Provider value={{ state, dispatch: () => {} }}>
      <div className="grid gap-4">
        <CalculationSummary />
        <SettlementStatementView />
      </div>
    </SettlementContext.Provider>
  );
}
