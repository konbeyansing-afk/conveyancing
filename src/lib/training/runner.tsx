"use client";

/**
 * Guided-task runner shared by every simulator in the workspace.
 *
 * The runner is deliberately generic over the simulator's state type: a task's
 * action steps are predicates over whatever state that simulator keeps, so the
 * practice-management simulator and the PEXA simulator can use the same
 * training layer without either knowing about the other.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { usePersistentReducer } from "@/lib/training/persist";

export type GuidedStepBase = {
  instruction: string;
  hint: string;
};

export type GuidedActionStep<TState> = GuidedStepBase & {
  kind: "action";
  /** Passes only when the trainee genuinely performed the action. */
  check: (state: TState) => boolean;
};

export type GuidedAnswerStep = GuidedStepBase & {
  kind: "answer";
  question: string;
  options: string[];
  correct: number;
  /** Shown once the trainee answers, right or wrong. */
  explanation: string;
};

export type GuidedStep<TState> = GuidedActionStep<TState> | GuidedAnswerStep;

export type GuidedTask<TState> = {
  id: string;
  title: string;
  /** One-line summary for the task list. */
  summary: string;
  difficulty: "Beginner" | "Core" | "Advanced";
  minutes: number;
  /** Realistic instruction as it would arrive from a fee earner. */
  brief: string;
  skills: string[];
  steps: GuidedStep<TState>[];
};

export type StepStatus = "pending" | "done";

export type TaskRun = {
  taskId: string;
  stepStatus: StepStatus[];
  hintsUsed: number[];
  finishedAt: number | null;
};

type TaskRunnerValue = {
  run: TaskRun | null;
  startTask: (taskId: string, stepCount: number) => void;
  stopTask: () => void;
  markStepsDone: (indexes: number[]) => void;
  revealHint: (index: number) => void;
  finish: () => void;
};

const TaskRunnerContext = createContext<TaskRunnerValue | null>(null);

type RunAction =
  | { type: "start"; taskId: string; stepCount: number }
  | { type: "stop" }
  | { type: "markDone"; indexes: number[] }
  | { type: "revealHint"; index: number }
  | { type: "finish" };

function runReducer(run: TaskRun | null, action: RunAction): TaskRun | null {
  switch (action.type) {
    case "start":
      return {
        taskId: action.taskId,
        stepStatus: Array.from({ length: action.stepCount }, () => "pending" as StepStatus),
        hintsUsed: [],
        finishedAt: null,
      };

    case "stop":
      return null;

    case "markDone": {
      if (!run) return run;
      let changed = false;
      const next = run.stepStatus.map((s, i) => {
        if (action.indexes.includes(i) && s !== "done") {
          changed = true;
          return "done" as StepStatus;
        }
        return s;
      });
      return changed ? { ...run, stepStatus: next } : run;
    }

    case "revealHint":
      if (!run || run.hintsUsed.includes(action.index)) return run;
      return { ...run, hintsUsed: [...run.hintsUsed, action.index] };

    case "finish":
      if (!run || run.finishedAt !== null) return run;
      return { ...run, finishedAt: Date.now() };

    default:
      return run;
  }
}

/**
 * Scenario progress is persisted alongside the simulator's own state, so a
 * refresh mid-task does not drop the trainee back at the scenario picker.
 * Each simulator passes its own key so the three never overwrite each other.
 */
export function TaskRunnerProvider({
  children,
  storageKey = "conveyancing-academy:task:default",
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [run, dispatch] = usePersistentReducer<TaskRun | null, RunAction>(
    storageKey,
    runReducer,
    () => null,
  );

  const startTask = useCallback(
    (taskId: string, stepCount: number) => dispatch({ type: "start", taskId, stepCount }),
    [dispatch],
  );
  const stopTask = useCallback(() => dispatch({ type: "stop" }), [dispatch]);
  const markStepsDone = useCallback(
    (indexes: number[]) => dispatch({ type: "markDone", indexes }),
    [dispatch],
  );
  const revealHint = useCallback(
    (index: number) => dispatch({ type: "revealHint", index }),
    [dispatch],
  );
  const finish = useCallback(() => dispatch({ type: "finish" }), [dispatch]);

  const value = useMemo(
    () => ({ run, startTask, stopTask, markStepsDone, revealHint, finish }),
    [run, startTask, stopTask, markStepsDone, revealHint, finish],
  );

  return <TaskRunnerContext.Provider value={value}>{children}</TaskRunnerContext.Provider>;
}

export function useTaskRunner(): TaskRunnerValue {
  const ctx = useContext(TaskRunnerContext);
  if (!ctx) throw new Error("useTaskRunner must be used inside <TaskRunnerProvider>");
  return ctx;
}

/**
 * Re-runs every step's checker whenever the simulator's state changes and marks
 * newly-satisfied steps done. Steps are sticky: once satisfied they stay
 * satisfied, so navigating away from a screen doesn't undo progress.
 */
export function useStepWatcher<TState>(checks: ((state: TState) => boolean)[], state: TState) {
  const { run, markStepsDone, finish } = useTaskRunner();

  useEffect(() => {
    if (!run) return;
    const newlyDone: number[] = [];
    checks.forEach((check, i) => {
      if (run.stepStatus[i] !== "done" && check(state)) newlyDone.push(i);
    });
    if (newlyDone.length > 0) markStepsDone(newlyDone);
    else if (run.stepStatus.every((s) => s === "done") && run.finishedAt === null) finish();
    // `checks` is rebuilt each render from a static task definition, so it is
    // intentionally excluded from the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, run, markStepsDone, finish]);
}
