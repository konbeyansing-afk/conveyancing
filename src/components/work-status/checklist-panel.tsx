"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ClipboardList, Lock } from "lucide-react";
import { updateChecklistTaskDetails, updateChecklistTaskStatus } from "@/lib/actions/checklist";
import {
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_VALUES,
  type ChecklistTaskView,
  dependencyBlockers,
  isRequired,
  isTaskDone,
  stageGateResult,
  stagesWithTasks,
  summarizeProgress,
  tasksForStage,
} from "@/lib/checklist";
import { MATTER_STAGE_LABELS, nextMatterStage } from "@/lib/matter-stage";
import { updateMatterStage } from "@/lib/actions/work-status";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import type { Jurisdiction, MatterStage } from "@prisma/client";

const statusTone: Record<string, string> = {
  NOT_STARTED: "text-muted-foreground",
  IN_PROGRESS: "text-primary",
  WAITING_PENDING: "text-warning",
  BLOCKED: "text-destructive",
  COMPLETED: "text-success",
  NOT_APPLICABLE: "text-muted-foreground",
};

function relativeDateTime(d: Date) {
  return d.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function ChecklistTaskRow({
  task,
  byKey,
  canEdit,
}: {
  task: ChecklistTaskView;
  byKey: Map<string, ChecklistTaskView>;
  canEdit: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const statusAction = updateChecklistTaskStatus.bind(null, task.id);
  const [statusState, statusFormAction, statusPending] = useActionState(statusAction, null);
  const detailsAction = updateChecklistTaskDetails.bind(null, task.id);
  const [detailsState, detailsFormAction, detailsPending] = useActionState(detailsAction, null);

  const blockers = dependencyBlockers(task, byKey);
  const locked = blockers.length > 0 && task.status !== "COMPLETED" && task.status !== "NOT_APPLICABLE";
  const done = isTaskDone(task.status);

  /**
   * `<form action={...}>` runs a native form reset after every submission —
   * the browser's default post-submit behaviour, which Next.js's Server
   * Action handling does not suppress. For an uncontrolled `<select
   * defaultValue>`, React only applies `defaultValue` at initial mount, so
   * that native reset can snap the visible value back to whatever it was
   * when this row first mounted — even though the server-side status
   * (`task.status`, freshly revalidated) is correct. Re-stamping the
   * select's DOM value from the prop on every render is a plain
   * synchronization, not a state update, so it belongs in an effect with no
   * dependency array (see the same pattern in update-status-dialog.tsx).
   */
  const statusSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (statusSelectRef.current && statusSelectRef.current.value !== task.status) {
      statusSelectRef.current.value = task.status;
    }
  });

  return (
    <li className="grid gap-1.5 rounded-lg border px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {isRequired(task) ? (
              <Badge variant="secondary" className="text-[0.65rem]">
                Required
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[0.65rem]">
                Optional
              </Badge>
            )}
            {task.section && <span className="text-[0.7rem] text-muted-foreground">{task.section}</span>}
          </div>
        </div>

        {canEdit ? (
          <form action={statusFormAction} className="flex shrink-0 items-center gap-1.5">
            <select
              ref={statusSelectRef}
              name="status"
              defaultValue={task.status}
              disabled={statusPending}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={`h-7 rounded-lg border border-input bg-background px-2 text-xs ${statusTone[task.status]}`}
              aria-label={`Status for ${task.title}`}
            >
              {CHECKLIST_STATUS_VALUES.map((s) => (
                <option key={s} value={s} disabled={s === "COMPLETED" && locked}>
                  {CHECKLIST_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className={`shrink-0 text-xs font-medium ${statusTone[task.status]}`}>
            {CHECKLIST_STATUS_LABELS[task.status]}
          </span>
        )}
      </div>

      {locked && (
        <p className="flex items-start gap-1 text-xs text-warning">
          <Lock className="mt-0.5 size-3 shrink-0" />
          Required first: {blockers.map((b) => b.title).join(", ")}
        </p>
      )}

      {task.status === "BLOCKED" && task.blockedReason && (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          {task.blockedReason}
        </p>
      )}

      {statusState?.error && <p className="text-xs text-destructive">{statusState.error}</p>}

      {task.status === "COMPLETED" && task.completedAt && (
        <p className="flex items-center gap-1 text-xs text-success">
          <Check className="size-3" />
          Completed {relativeDateTime(task.completedAt)}
          {task.completedByName ? ` by ${task.completedByName}` : ""}
        </p>
      )}

      {canEdit && (
        <div>
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {task.notes ? "Edit note" : "Add note"}
          </button>
          {task.notes && !showNotes && <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{task.notes}</p>}
          {showNotes && (
            <form
              action={detailsFormAction}
              className="mt-1.5 grid gap-1.5"
              onSubmit={() => setShowNotes(false)}
            >
              <Textarea name="notes" defaultValue={task.notes ?? ""} rows={2} className="text-xs" />
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" variant="outline" disabled={detailsPending} className="h-6 px-2 text-[0.7rem]">
                  {detailsPending ? "Saving…" : "Save note"}
                </Button>
                {detailsState?.error && <span className="text-xs text-destructive">{detailsState.error}</span>}
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

function StageGateBanner({
  workItemId,
  jurisdiction,
  matterStage,
  tasks,
  canEdit,
}: {
  workItemId: string;
  jurisdiction: Jurisdiction;
  matterStage: MatterStage;
  tasks: ChecklistTaskView[];
  canEdit: boolean;
}) {
  const next = nextMatterStage(jurisdiction, matterStage);
  const action = updateMatterStage.bind(null, workItemId);
  const [state, formAction, pending] = useActionState(action, null);
  if (!next) return null;

  const gate = stageGateResult(jurisdiction, tasks, matterStage, next);

  if (!gate.allowed) {
    const blockingCount = gate.blockingTasks.length;
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" />
        <p>
          <span className="font-medium text-foreground">Next Stage Locked.</span> Complete the {blockingCount} required
          task{blockingCount === 1 ? "" : "s"} in {MATTER_STAGE_LABELS[gate.blockingStage]} before moving to{" "}
          {MATTER_STAGE_LABELS[next]}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs">
      <p className="flex items-center gap-1.5">
        <Check className="size-3.5 text-success" />
        <span className="font-medium text-foreground">Stage Complete.</span>
      </p>
      {canEdit && (
        <form action={formAction}>
          <input type="hidden" name="newStage" value={next} />
          <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-6 px-2 text-[0.7rem]">
            {pending ? "Moving…" : `Continue to ${MATTER_STAGE_LABELS[next]} →`}
          </Button>
        </form>
      )}
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </div>
  );
}

export function ChecklistPanel({
  workItemId,
  jurisdiction,
  matterStage,
  tasks,
  canEdit,
}: {
  workItemId: string;
  jurisdiction: Jurisdiction;
  matterStage: MatterStage;
  tasks: ChecklistTaskView[];
  canEdit: boolean;
}) {
  const [openStage, setOpenStage] = useState<MatterStage | null>(matterStage);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Checklist not available yet"
        description="This jurisdiction and matter type combination doesn't have a checklist template yet."
      />
    );
  }

  const stages = stagesWithTasks(jurisdiction, tasks);
  const overall = summarizeProgress(tasks);
  const byKey = new Map(tasks.map((t) => [t.taskKey, t]));

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground uppercase tracking-wide">Matter Progress</span>
          <span className="font-semibold tabular-nums">
            {overall.completed} / {overall.total} · {overall.percent}%
          </span>
        </div>
        <Progress value={overall.percent} />
      </div>

      <StageGateBanner
        workItemId={workItemId}
        jurisdiction={jurisdiction}
        matterStage={matterStage}
        tasks={tasks}
        canEdit={canEdit}
      />

      <div className="grid gap-2">
        {stages.map((stage) => {
          const stageTasks = tasksForStage(tasks, stage);
          const progress = summarizeProgress(stageTasks);
          const isOpen = openStage === stage;
          const isCurrent = stage === matterStage;
          return (
            <div key={stage} className={`rounded-lg border ${isCurrent ? "border-primary/40" : ""}`}>
              <button
                type="button"
                onClick={() => setOpenStage(isOpen ? null : stage)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {MATTER_STAGE_LABELS[stage]}
                  {isCurrent && (
                    <Badge className="text-[0.6rem]" variant="default">
                      Current
                    </Badge>
                  )}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {progress.completed} / {progress.total} · {progress.percent}%
                  <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              <div className="px-3 pb-2">
                <Progress value={progress.percent} className="h-1.5" />
              </div>
              {isOpen && (
                <ul className="grid gap-1.5 border-t px-3 py-2">
                  {stageTasks.map((task) => (
                    <ChecklistTaskRow key={task.taskKey} task={task} byKey={byKey} canEdit={canEdit} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
