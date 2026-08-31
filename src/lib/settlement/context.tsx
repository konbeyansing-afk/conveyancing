"use client";

/**
 * The settlement calculator's React Context, on its own so two different
 * Provider implementations can feed it: SettlementProvider in store.tsx
 * (the standalone practice tool, localStorage-backed) and
 * MatterSettlementProvider in components/settlement/matter-settlement-store.tsx
 * (a specific matter's calculation, server-backed). Every consumer
 * component (AdjustmentList, MatterSetupSection, useSettlementStatement,
 * ...) calls useSettlement() without caring which Provider is above it —
 * that's what makes the whole existing UI reusable for the matter-linked
 * calculator with zero changes to those components.
 */

import { createContext, useContext, type Dispatch } from "react";
import type { SettlementAction, SettlementState } from "./state";

export type SettlementContextValue = { state: SettlementState; dispatch: Dispatch<SettlementAction> };

export const SettlementContext = createContext<SettlementContextValue | null>(null);

export function useSettlement(): SettlementContextValue {
  const ctx = useContext(SettlementContext);
  if (!ctx) throw new Error("useSettlement must be used inside <SettlementProvider> or <MatterSettlementProvider>");
  return ctx;
}
