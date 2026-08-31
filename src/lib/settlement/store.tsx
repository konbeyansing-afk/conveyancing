"use client";

/**
 * Client-side state for the standalone settlement calculator (the practice
 * tool at /app/tools/settlement-calculator). A single working copy,
 * persisted to localStorage (not sessionStorage — this is a real working
 * document a colleague may return to after closing the tab, not a training
 * sandbox), autosaved on every change.
 *
 * The state shape/reducer itself lives in state.ts (pure, no React) and is
 * re-exported here unchanged, so every existing import of this module keeps
 * working — this file now only adds the browser-storage-backed Provider on
 * top. The matter-linked calculator (src/components/settlement/matter-*)
 * uses a different, server-persisted provider built on the same state.ts.
 */

import { useMemo, type ReactNode } from "react";
import { usePersistentReducer } from "@/lib/training/persist";
import { newSettlementState, settlementReducer } from "./state";
import { SettlementContext } from "./context";

export {
  newMatterDetails,
  newSettlementState,
  settlementReducer,
  type SettlementAction,
  type SettlementAdjustmentItem,
  type SettlementState,
} from "./state";
export { useSettlement } from "./context";

export const SETTLEMENT_STORAGE_KEY = "conveyancing-academy:settlement-calculator";

export function SettlementProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = usePersistentReducer(
    SETTLEMENT_STORAGE_KEY,
    settlementReducer,
    newSettlementState,
    { storage: "local" },
  );
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <SettlementContext.Provider value={value}>{children}</SettlementContext.Provider>;
}
