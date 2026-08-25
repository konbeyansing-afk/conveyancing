"use client";

import { computeAdjustmentResults } from "@/lib/settlement/compute";
import { buildSettlementStatement } from "@/lib/settlement/statement";
import { useSettlement } from "@/lib/settlement/store";
import type { AdjustmentCalculationResult, SettlementStatement } from "@/lib/settlement/types";

/** Runs the engine against the current stored state — the one place the UI computes a statement. */
export function useSettlementStatement(): { results: AdjustmentCalculationResult[]; statement: SettlementStatement } {
  const { state } = useSettlement();
  const results = computeAdjustmentResults(state.adjustments, { settlementDate: state.matter.settlementDate });
  const statement = buildSettlementStatement(state.matter, results, state.costs);
  return { results, statement };
}
