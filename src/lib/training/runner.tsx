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
  useState,
  type ReactNode,
} from "react";

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

export function TaskRunnerProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<TaskRun | null>(null);

  const startTask = useCallback((taskId: string, stepCount: number) => {
    setRun({
      taskId,
      stepStatus: Array.from({ length: stepCount }, () => "pending" as StepStatus),
      hintsUsed: [],
      finishedAt: null,
    });
  }, []);

  const stopTask = useCallback(() => setRun(null), []);

  const markStepsDone = useCallback((indexes: number[]) => {
    setRun((prev) => {
      if (!prev) return prev;
      let changed = false;
      const next = prev.stepStatus.map((s, i) => {
        if (indexes.includes(i) && s !== "done") {
          changed = true;
          return "done" as StepStatus;
        }
        return s;
      });
      return changed ? { ...prev, stepStatus: next } : prev;
    });
  }, []);

  const revealHint = useCallback((index: number) => {
    setRun((prev) =>
      prev && !prev.hintsUsed.includes(index)
        ? { ...prev, hintsUsed: [...prev.hintsUsed, index] }
        : prev,
    );
  }, []);

  const finish = useCallback(() => {
    setRun((prev) => (prev && prev.finishedAt === null ? { ...prev, finishedAt: Date.now() } : prev));
  }, []);

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
