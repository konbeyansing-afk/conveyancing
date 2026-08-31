"use client";

/**
 * Provides settlement calculator state for one specific matter's
 * calculation, server-backed rather than localStorage-backed — the
 * counterpart to SettlementProvider (store.tsx) for the standalone
 * practice tool. Feeds the same shared SettlementContext (context.tsx),
 * so every existing calculator component (AdjustmentList,
 * MatterSetupSection, useSettlementStatement, ...) works under it
 * unchanged.
 *
 * Explicit Save Draft / Finalise, not silent autosave — matches spec
 * section 20's explicit buttons, and avoids writing to the database on
 * every keystroke of a multi-field form.
 */

import { createContext, useCallback, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import { SettlementContext } from "@/lib/settlement/context";
import { settlementReducer } from "@/lib/settlement/state";
import type { SettlementState } from "@/lib/settlement/state";
import {
  finaliseSettlementCalculation,
  resetSettlementDraft,
  saveSettlementDraft,
  type SettlementActionResult,
} from "@/lib/actions/settlement";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface MatterSettlementActionsValue {
  saveStatus: SaveStatus;
  saveError: string | null;
  save: () => Promise<SettlementActionResult>;
  finalise: () => Promise<SettlementActionResult>;
  reset: () => Promise<void>;
  isDirty: boolean;
}

const MatterActionsContext = createContext<MatterSettlementActionsValue | null>(null);

export function useMatterSettlementActions(): MatterSettlementActionsValue {
  const ctx = useContext(MatterActionsContext);
  if (!ctx) throw new Error("useMatterSettlementActions must be used inside <MatterSettlementProvider>");
  return ctx;
}

export function MatterSettlementProvider({
  workItemId,
  initialState,
  children,
}: {
  workItemId: string;
  initialState: SettlementState;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(settlementReducer, initialState);
  const [savedState, setSavedState] = useState(initialState);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Immutable reducer updates always produce a new object on change, so
  // reference inequality against the last-saved snapshot is a correct,
  // cheap "has anything changed since Save Draft" check.
  const isDirty = state !== savedState;

  const save = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError(null);
    const result = await saveSettlementDraft(workItemId, state);
    if (result.success) {
      setSavedState(state);
      setSaveStatus("saved");
    } else {
      setSaveStatus("error");
      setSaveError(result.error);
    }
    return result;
  }, [workItemId, state]);

  const finalise = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError(null);
    const result = await finaliseSettlementCalculation(workItemId, state);
    if (!result.success) {
      setSaveStatus("error");
      setSaveError(result.error);
    }
    return result;
  }, [workItemId, state]);

  const reset = useCallback(async () => {
    await resetSettlementDraft(workItemId);
    window.location.reload();
  }, [workItemId]);

  const settlementValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  const actionsValue = useMemo(
    () => ({ saveStatus, saveError, save, finalise, reset, isDirty }),
    [saveStatus, saveError, save, finalise, reset, isDirty],
  );

  return (
    <SettlementContext.Provider value={settlementValue}>
      <MatterActionsContext.Provider value={actionsValue}>{children}</MatterActionsContext.Provider>
    </SettlementContext.Provider>
  );
}
