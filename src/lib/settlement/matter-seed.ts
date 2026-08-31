/**
 * Seeds a fresh SettlementState from a WorkItem when a settlement
 * calculation is first opened from inside a matter (spec: "automatically
 * associate the calculation with that matter... automatically populate
 * available information"). Deliberately minimal: WorkItem does not carry a
 * property address, contract price, or contract/settlement date fields of
 * its own (those are calculator-specific inputs, tracked only inside the
 * calculation itself, per section 6's "clearly distinguish matter data from
 * calculator inputs") — only transactionType (from matterType) and a
 * starting propertyAddress guess (from the matter's own title) are
 * actually derivable, and both stay freely editable in the calculator.
 */

import type { MatterType } from "@prisma/client";
import { newSettlementState } from "./state";
import type { SettlementState } from "./state";
import type { TransactionType } from "./types";

export function seedSettlementStateFromMatter(matter: { title: string; matterType: MatterType | null }): SettlementState {
  const state = newSettlementState();
  const transactionType: TransactionType = matter.matterType === "SALE" ? "SALE" : "PURCHASE";
  return {
    ...state,
    matter: { ...state.matter, transactionType, propertyAddress: matter.title },
  };
}
