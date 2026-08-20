"use client";

/**
 * The guided-task side panel, shared by every simulator.
 *
 * It hands the trainee a realistic instruction, watches the simulator's state
 * to see whether they actually did it, and asks the "why" questions that a
 * state check can't answer on its own.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleDot,
  Clock,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useStepWatcher,
  useTaskRunner,
  type GuidedAnswerStep,
  type GuidedTask,
} from "@/lib/training/runner";
import { cn } from "@/lib/utils";

function difficultyTone(d: GuidedTask<unknown>["difficulty"]) {
  switch (d) {
    case "Beginner":
      return "bg-success/12 text-success border-success/25";
    case "Core":
      return "bg-primary/10 text-primary border-primary/25";
    default:
      return "bg-warning/12 text-warning border-warning/30";
  }
}

/* ------------------------------------------------------------------ */
/* Task picker                                                         */
/* ------------------------------------------------------------------ */

function TaskPicker<TState>({ tasks, intro }: { tasks: GuidedTask<TState>[]; intro: string }) {
  const { startTask } = useTaskRunner();
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4 text-primary" />
          Guided tasks
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{intro}</p>
      </div>

      <div className="grid gap-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => startTask(task.id, task.steps.length)}
            className="group rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-balance group-hover:text-primary">
                {task.title}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  difficultyTone(task.difficulty),
                )}
              >
                {task.difficulty}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{task.summary}</p>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {task.minutes} min
              </span>
              <span className="inline-flex items-center gap-1">
                <CircleDot className="size-3" />
                {task.steps.length} steps
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Running task                                                        */
/* ------------------------------------------------------------------ */

function AnswerStep({
  step,
  done,
  onCorrect,
}: {
  step: GuidedAnswerStep;
  done: boolean;
  onCorrect: () => void;
}) {
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);

  return (
    <div className="mt-2 grid gap-2">
      <p className="text-xs font-medium">{step.question}</p>
      <div className="grid gap-1.5">
        {step.options.map((opt, i) => {
          const isWrong = wrongPicks.includes(i);
          const isCorrect = done && i === step.correct;
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              onClick={() => {
                if (i === step.correct) onCorrect();
                else setWrongPicks((w) => (w.includes(i) ? w : [...w, i]));
              }}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                isCorrect
                  ? "border-success/40 bg-success/10 text-foreground"
                  : isWrong
                    ? "border-destructive/40 bg-destructive/5 text-muted-foreground line-through"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/30",
                done && !isCorrect && "opacity-60",
              )}
            >
              <span className="mr-1.5 font-semibold text-muted-foreground">
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      {(done || wrongPicks.length > 0) && (
        <p
          className={cn(
            "rounded-md border px-2.5 py-2 text-xs",
            done
              ? "border-success/30 bg-success/8 text-foreground"
              : "border-warning/30 bg-warning/8 text-foreground",
          )}
        >
          {done ? step.explanation : "Not quite — have another look and try again."}
        </p>
      )}
    </div>
  );
}

function RunningTask<TState>({
  task,
  state,
  actionCount,
  footnote,
}: {
  task: GuidedTask<TState>;
  state: TState;
  actionCount: number;
  footnote: string;
}) {
  const { run, stopTask, markStepsDone, revealHint, startTask } = useTaskRunner();

  const checks = useMemo(
    () => task.steps.map((s) => (s.kind === "action" ? s.check : () => false)),
    [task],
  );
  useStepWatcher(checks, state);

  if (!run) return null;

  const doneCount = run.stepStatus.filter((s) => s === "done").length;
  const allDone = doneCount === task.steps.length;
  const currentIndex = run.stepStatus.findIndex((s) => s !== "done");
  const score = Math.max(
    0,
    Math.round(((task.steps.length - run.hintsUsed.length * 0.5) / task.steps.length) * 100),
  );

  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={stopTask}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All tasks
        </button>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            difficultyTone(task.difficulty),
          )}
        >
          {task.difficulty}
        </span>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-balance">{task.title}</h2>
        <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Your instruction
          </div>
          <p className="text-xs leading-relaxed">{task.brief}</p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Step {Math.min(doneCount + (allDone ? 0 : 1), task.steps.length)} of {task.steps.length}
          </span>
          <span>{doneCount} complete</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full transition-all", allDone ? "bg-success" : "bg-primary")}
            style={{ width: `${(doneCount / task.steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="grid gap-2">
        {task.steps.map((step, i) => {
          const done = run.stepStatus[i] === "done";
          const active = i === currentIndex;
          const hintShown = run.hintsUsed.includes(i);
          return (
            <li
              key={i}
              className={cn(
                "rounded-lg border p-2.5 transition-colors",
                done
                  ? "border-success/30 bg-success/6"
                  : active
                    ? "border-primary/40 bg-card shadow-sm"
                    : "border-border bg-card opacity-60",
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold",
                    done
                      ? "bg-success text-success-foreground"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-2.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs", done && "text-muted-foreground")}>{step.instruction}</p>

                  {active && step.kind === "answer" && (
                    <AnswerStep step={step} done={done} onCorrect={() => markStepsDone([i])} />
                  )}
                  {done && step.kind === "answer" && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{step.explanation}</p>
                  )}

                  {active && !done && (
                    <div className="mt-2">
                      {hintShown ? (
                        <p className="rounded-md border border-warning/30 bg-warning/8 px-2.5 py-1.5 text-[11px]">
                          <Lightbulb className="mr-1 inline size-3 text-warning" />
                          {step.hint}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => revealHint(i)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Lightbulb className="size-3" />
                          Show a hint
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {allDone && (
        <div className="rounded-lg border border-success/35 bg-success/8 p-3">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-success" />
            <span className="text-sm font-semibold">Task complete</span>
          </div>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Steps completed</span>
              <span className="font-medium text-foreground">
                {task.steps.length} / {task.steps.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Hints used</span>
              <span className="font-medium text-foreground">{run.hintsUsed.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Score</span>
              <span className="font-medium text-foreground">{score}%</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {task.skills.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={stopTask} className="flex-1">
              Next task
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => startTask(task.id, task.steps.length)}
              title="Restart this task"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">{footnote}</p>
      {actionCount > 0 && (
        <p className="text-[10px] text-muted-foreground/70">{actionCount} actions recorded</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel shell                                                         */
/* ------------------------------------------------------------------ */

export function TaskPanel<TState>({
  tasks,
  state,
  actionCount,
  intro,
  footnote,
  onClose,
}: {
  tasks: GuidedTask<TState>[];
  state: TState;
  /** Number of logged actions, shown as a small progress hint. */
  actionCount: number;
  intro: string;
  footnote: string;
  onClose?: () => void;
}) {
  const { run } = useTaskRunner();
  const task = run ? tasks.find((t) => t.id === run.taskId) : undefined;

  return (
    <aside className="flex w-[330px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Training
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Hide training panel"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {task ? (
          <RunningTask
            task={task}
            state={state}
            actionCount={actionCount}
            footnote={footnote}
          />
        ) : (
          <TaskPicker tasks={tasks} intro={intro} />
        )}
      </div>
    </aside>
  );
}
