/**
 * Runs the (unmodified) calculation engine against a SettlementState to
 * produce the two things persistence needs: the estimated settlement
 * amount to snapshot, and a calculation status for "Ready / Incomplete /
 * Error" (spec section 19). Pure — safe to call from a server action, a
 * Server Component, or a client component; it is the one place both the
 * server-side snapshot and (via useSettlementStatement) the UI derive
 * these from, so they can never disagree.
 */

import { computeAdjustmentResults } from "./compute";
import { buildSettlementStatement } from "./statement";
import type { Cents } from "./money";
import type { SettlementState } from "./state";

export type CalculationStatus = "READY" | "INCOMPLETE" | "ERROR";

export interface SettlementSnapshot {
  /** The buyer's balance required (a Purchase matter) or the seller's net proceeds (a Sale matter) — "the settlement amount" from that matter's own perspective. Null when it can't yet be computed. */
  settlementAmountCents: Cents | null;
  status: CalculationStatus;
  /** How many of the two hard-required matter fields (settlement date, contract price) are still missing. */
  missingRequiredCount: number;
}

export function computeSettlementSnapshot(state: SettlementState): SettlementSnapshot {
  const results = computeAdjustmentResults(state.adjustments, { settlementDate: state.matter.settlementDate });
  const statement = buildSettlementStatement(state.matter, results, state.costs);

  const missingRequiredCount = (state.matter.settlementDate ? 0 : 1) + (state.matter.contractPriceCents === null ? 1 : 0);

  const hasError =
    statement.messages.some((m) => m.tier === "error") || results.some((r) => r.messages.some((m) => m.tier === "error"));

  let status: CalculationStatus;
  if (missingRequiredCount > 0) status = "INCOMPLETE";
  else if (hasError) status = "ERROR";
  else status = "READY";

  const settlementAmountCents =
    missingRequiredCount > 0
      ? null
      : state.matter.transactionType === "SALE"
        ? statement.seller.netProceedsCents
        : statement.buyer.balanceRequiredCents;

  return { settlementAmountCents, status, missingRequiredCount };
}
