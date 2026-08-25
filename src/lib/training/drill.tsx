"use client";

/**
 * Data-entry accuracy drills, shared by every simulator in the workspace.
 *
 * A drill is a different exercise from a guided task: instead of ticking off
 * steps as the trainee performs real actions in the app, it hands them a
 * source document and a blank form, and checks what they typed against
 * known-correct values once they submit. The skill being practised is
 * reading a real document accurately and transcribing it correctly — not
 * navigation or workflow logic, which the guided tasks already cover.
 *
 * Generic over nothing in particular: unlike GuidedTask, a drill never reads
 * simulator state, so the same shapes work unchanged for every simulator.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePersistentReducer } from "@/lib/training/persist";
import type { Difficulty } from "@/lib/training/runner";

export type DrillFieldType = "text" | "date" | "money" | "choice";

export type DrillField = {
  key: string;
  label: string;
  type: DrillFieldType;
  choices?: string[];
};

/** A source document rendered as a simple heading + freeform paragraphs — an email, a letter, a particulars sheet. */
export type DrillDocument = {
  heading: string;
  meta?: string;
  paragraphs: string[];
};

export type Drill = {
  id: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  minutes: number;
  brief: string;
  document: DrillDocument;
  fields: DrillField[];
  /** Canonical expected value per field key: ISO date, plain-number money, exact choice/text. */
  expected: Record<string, string>;
};

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function normalizeText(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseMoney(v: string): number | null {
  const cleaned = v.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

/** Accepts ISO (yyyy-mm-dd, what a native date input sends) or Australian dd/mm/yyyy. */
function parseDateFlexible(v: string): string | null {
  const trimmed = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

/** Whether a trainee's answer matches the expected value for a field of the given type. */
export function checkDrillField(type: DrillFieldType, given: string, expected: string): boolean {
  if (!given.trim()) return false;
  switch (type) {
    case "money": {
      const g = parseMoney(given);
      const e = parseMoney(expected);
      return g !== null && e !== null && g === e;
    }
    case "date": {
      const g = parseDateFlexible(given);
      const e = parseDateFlexible(expected) ?? expected;
      return g !== null && g === e;
    }
    case "choice":
    case "text":
    default:
      return normalizeText(given) === normalizeText(expected);
  }
}

export type DrillScore = {
  results: Record<string, boolean>;
  correct: number;
  total: number;
};

export function scoreDrill(drill: Drill, answers: Record<string, string>): DrillScore {
  const results: Record<string, boolean> = {};
  let correct = 0;
  for (const field of drill.fields) {
    const ok = checkDrillField(field.type, answers[field.key] ?? "", drill.expected[field.key] ?? "");
    results[field.key] = ok;
    if (ok) correct += 1;
  }
  return { results, correct, total: drill.fields.length };
}

/* ------------------------------------------------------------------ */
/* Run state                                                           */
/* ------------------------------------------------------------------ */

export type DrillRunState = {
  drillId: string | null;
  answers: Record<string, string>;
  submitted: boolean;
  results: Record<string, boolean> | null;
};

const initialDrillState: DrillRunState = {
  drillId: null,
  answers: {},
  submitted: false,
  results: null,
};

type DrillRunAction =
  | { type: "start"; drillId: string }
  | { type: "answer"; key: string; value: string }
  | { type: "submit"; results: Record<string, boolean> }
  | { type: "retry" }
  | { type: "exit" };

function drillRunReducer(state: DrillRunState, action: DrillRunAction): DrillRunState {
  switch (action.type) {
    case "start":
      return { drillId: action.drillId, answers: {}, submitted: false, results: null };
    case "answer":
      if (state.submitted) return state;
      return { ...state, answers: { ...state.answers, [action.key]: action.value } };
    case "submit":
      return { ...state, submitted: true, results: action.results };
    case "retry":
      return { ...state, answers: {}, submitted: false, results: null };
    case "exit":
      return initialDrillState;
    default:
      return state;
  }
}

type DrillRunnerValue = {
  run: DrillRunState;
  start: (drillId: string) => void;
  setAnswer: (key: string, value: string) => void;
  submit: (results: Record<string, boolean>) => void;
  retry: () => void;
  exit: () => void;
};

const DrillRunnerContext = createContext<DrillRunnerValue | null>(null);

/** Drill progress is persisted alongside the simulator's own state, keyed per simulator, so a refresh mid-drill doesn't lose typed answers. */
export function DrillRunnerProvider({
  children,
  storageKey,
}: {
  children: ReactNode;
  storageKey: string;
}) {
  const [run, dispatch] = usePersistentReducer<DrillRunState, DrillRunAction>(
    storageKey,
    drillRunReducer,
    () => initialDrillState,
  );

  const start = useCallback((drillId: string) => dispatch({ type: "start", drillId }), [dispatch]);
  const setAnswer = useCallback(
    (key: string, value: string) => dispatch({ type: "answer", key, value }),
    [dispatch],
  );
  const submit = useCallback(
    (results: Record<string, boolean>) => dispatch({ type: "submit", results }),
    [dispatch],
  );
  const retry = useCallback(() => dispatch({ type: "retry" }), [dispatch]);
  const exit = useCallback(() => dispatch({ type: "exit" }), [dispatch]);

  const value = useMemo(
    () => ({ run, start, setAnswer, submit, retry, exit }),
    [run, start, setAnswer, submit, retry, exit],
  );

  return <DrillRunnerContext.Provider value={value}>{children}</DrillRunnerContext.Provider>;
}

export function useDrillRunner(): DrillRunnerValue {
  const ctx = useContext(DrillRunnerContext);
  if (!ctx) throw new Error("useDrillRunner must be used inside <DrillRunnerProvider>");
  return ctx;
}
