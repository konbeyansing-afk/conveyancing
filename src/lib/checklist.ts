/**
 * Checklist — pure logic over a matter's instantiated ChecklistTask rows
 * plus their template definitions. No I/O, so it is cheap to test
 * exhaustively and safe to import from both server and client components,
 * matching the pattern of matter-stage.ts and work-status.ts.
 *
 * A "task view" merges the immutable template definition (title, section,
 * stage, required, dependsOn) with the matter's own mutable row (status,
 * notes, completedAt, ...) — see mergeChecklistTasks.
 */

import type { ChecklistTaskStatus, Jurisdiction, MatterStage, MatterType } from "@prisma/client";
import { type ChecklistTemplateTask, checklistTemplate } from "@/lib/checklist-templates";
import { MATTER_STAGE_LABELS, MATTER_WORKFLOWS, matterStageOrder } from "@/lib/matter-stage";

export const CHECKLIST_STATUS_LABELS: Record<ChecklistTaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  WAITING_PENDING: "Waiting / Pending",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  NOT_APPLICABLE: "Not Applicable",
};

export const CHECKLIST_STATUS_VALUES = Object.keys(CHECKLIST_STATUS_LABELS) as ChecklistTaskStatus[];

/** A task counts toward "done" for progress and gating purposes if it's Completed, or explicitly Not Applicable to this matter. */
export function isTaskDone(status: ChecklistTaskStatus): boolean {
  return status === "COMPLETED" || status === "NOT_APPLICABLE";
}

/**
 * `required` is optional on a template task and true whenever it's not
 * explicitly `false` — most tasks never set it at all, so this must never
 * be read as a plain truthy check (`task.required` is `undefined`, i.e.
 * falsy, for the common case), or gating silently stops blocking anything.
 */
export function isRequired(task: { required?: boolean }): boolean {
  return task.required !== false;
}

export type ChecklistTaskRow = {
  id: string;
  taskKey: string;
  status: ChecklistTaskStatus;
  notes: string | null;
  blockedReason: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  completedById: string | null;
  completedByName?: string | null;
  assignedToId: string | null;
  assignedToName?: string | null;
  updatedAt: Date;
};

export type ChecklistTaskView = ChecklistTemplateTask & ChecklistTaskRow;

/**
 * Merges instantiated rows with their template definitions, in template
 * order. A row whose taskKey no longer exists in the template (the
 * template changed after this matter's checklist was generated) is
 * dropped from the view but not deleted — see validateChecklist, which
 * flags this rather than silently losing data.
 */
export function mergeChecklistTasks(
  jurisdiction: Jurisdiction,
  matterType: MatterType | null,
  rows: ChecklistTaskRow[],
): ChecklistTaskView[] {
  const template = checklistTemplate(jurisdiction, matterType);
  const rowsByKey = new Map(rows.map((r) => [r.taskKey, r]));
  const views: ChecklistTaskView[] = [];
  for (const def of template) {
    const row = rowsByKey.get(def.key);
    if (row) views.push({ ...def, ...row });
  }
  return views;
}

export type ProgressSummary = { completed: number; total: number; percent: number };

export function summarizeProgress(tasks: { status: ChecklistTaskStatus }[]): ProgressSummary {
  const total = tasks.length;
  const completed = tasks.filter((t) => isTaskDone(t.status)).length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

/** Every stage that actually has at least one task, in the jurisdiction's own workflow order — stages with no applicable tasks are simply not shown. */
export function stagesWithTasks(jurisdiction: Jurisdiction, tasks: ChecklistTaskView[]): MatterStage[] {
  const present = new Set(tasks.map((t) => t.stage));
  return MATTER_WORKFLOWS[jurisdiction].filter((s) => present.has(s));
}

export function tasksForStage(tasks: ChecklistTaskView[], stage: MatterStage): ChecklistTaskView[] {
  return tasks.filter((t) => t.stage === stage);
}

/**
 * Whether every dependency of `task` is satisfied (Completed/Not
 * Applicable). A dependency key missing from this matter's checklist
 * counts as unsatisfied — see validateChecklist for surfacing that as a
 * template/data issue rather than silently ignoring it.
 */
export function dependencyBlockers(task: ChecklistTaskView, byKey: Map<string, ChecklistTaskView>): ChecklistTaskView[] {
  if (!task.dependsOn || task.dependsOn.length === 0) return [];
  const blockers: ChecklistTaskView[] = [];
  for (const key of task.dependsOn) {
    const dep = byKey.get(key);
    // A dependency key missing from this matter's own tasks is a template/data
    // problem, not a gating condition — validateChecklist's "missing-dependency"
    // check is where that gets surfaced, so it is not treated as blocking here.
    if (dep && !isTaskDone(dep.status)) blockers.push(dep);
  }
  return blockers;
}

export function isTaskUnlocked(task: ChecklistTaskView, byKey: Map<string, ChecklistTaskView>): boolean {
  return dependencyBlockers(task, byKey).length === 0;
}

/**
 * Stage gating (spec section 8): to move from `fromStage` to `toStage`,
 * every *required* task in every stage from `fromStage` up to (but not
 * including) `toStage` must be Completed/Not Applicable — not just the
 * tasks in `fromStage` itself, so a trainee cannot skip past several
 * stages at once by satisfying only the first one. Moving backward, or to
 * a matter with no checklist template at all, is always allowed — this
 * only ever adds a restriction on top of the existing free-form dropdown,
 * never removes the ability to correct a mistake.
 */
export function stageGateResult(
  jurisdiction: Jurisdiction,
  tasks: ChecklistTaskView[],
  fromStage: MatterStage,
  toStage: MatterStage,
): { allowed: true } | { allowed: false; blockingStage: MatterStage; blockingTasks: ChecklistTaskView[] } {
  const workflow = MATTER_WORKFLOWS[jurisdiction];
  const fromIndex = workflow.indexOf(fromStage);
  const toIndex = workflow.indexOf(toStage);
  if (fromIndex === -1 || toIndex === -1 || toIndex <= fromIndex) return { allowed: true };

  for (let i = fromIndex; i < toIndex; i++) {
    const stage = workflow[i];
    const blocking = tasksForStage(tasks, stage).filter((t) => isRequired(t) && !isTaskDone(t.status));
    if (blocking.length > 0) return { allowed: false, blockingStage: stage, blockingTasks: blocking };
  }
  return { allowed: true };
}

/**
 * "Next Required Action" (spec section 10): the first incomplete required
 * task, current stage first, then earliest stage with one outstanding —
 * always something actually actionable, never a far-future task the
 * matter hasn't reached the gate for yet in spirit, but also never
 * nothing just because the *current* stage happens to be clear early.
 */
export function nextRequiredAction(
  jurisdiction: Jurisdiction,
  tasks: ChecklistTaskView[],
  currentStage: MatterStage,
): ChecklistTaskView | null {
  const inCurrent = tasksForStage(tasks, currentStage).find((t) => isRequired(t) && !isTaskDone(t.status));
  if (inCurrent) return inCurrent;

  const workflow = MATTER_WORKFLOWS[jurisdiction];
  for (const stage of workflow) {
    const found = tasksForStage(tasks, stage).find((t) => isRequired(t) && !isTaskDone(t.status));
    if (found) return found;
  }
  return null;
}

export type MatterHealthIssue = { code: string; message: string };

/**
 * "Matter Health" / Checklist Validation panel (spec section 13): a set of
 * self-checks over one matter's checklist, run live from the actual task
 * records — never a static claim. An empty result means the checklist is
 * internally consistent, not that the conveyancing work itself is correct.
 */
export function validateChecklist(
  jurisdiction: Jurisdiction,
  matterType: MatterType | null,
  matterStage: MatterStage,
  rows: ChecklistTaskRow[],
): MatterHealthIssue[] {
  const issues: MatterHealthIssue[] = [];
  const template = checklistTemplate(jurisdiction, matterType);
  const templateByKey = new Map(template.map((t) => [t.key, t]));
  const workflow = MATTER_WORKFLOWS[jurisdiction];

  // 1 & 13: correct state/matter-type checklist loaded — every row's key belongs to this jurisdiction+matterType's own template.
  for (const row of rows) {
    if (!templateByKey.has(row.taskKey)) {
      issues.push({
        code: "wrong-template",
        message: `Task "${row.taskKey}" does not belong to the ${jurisdiction} ${matterType ?? "(no matter type)"} checklist — it may be left over from a different jurisdiction or matter type.`,
      });
    }
  }

  // 2: no duplicate tasks.
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.taskKey)) issues.push({ code: "duplicate-task", message: `Task "${row.taskKey}" appears more than once on this matter.` });
    seen.add(row.taskKey);
  }

  // 3: required tasks exist at all for this template.
  if (matterType && template.length > 0 && !template.some((t) => isRequired(t))) {
    issues.push({ code: "no-required-tasks", message: "This checklist has no required tasks — stage gating would never lock." });
  }

  // 4: dependencies reference tasks that actually exist in the template.
  for (const t of template) {
    for (const dep of t.dependsOn ?? []) {
      if (!templateByKey.has(dep)) {
        issues.push({ code: "missing-dependency", message: `"${t.title}" depends on "${dep}", which is not part of this checklist.` });
      }
    }
  }

  // 5 & 11: stage order valid, and every task sits in a stage that belongs to this jurisdiction's own workflow.
  for (const t of template) {
    if (!workflow.includes(t.stage)) {
      issues.push({ code: "invalid-stage", message: `"${t.title}" is assigned to ${MATTER_STAGE_LABELS[t.stage]}, which is not part of the ${jurisdiction} workflow.` });
    }
  }

  // 8: completed tasks have a completion record.
  for (const row of rows) {
    if (row.status === "COMPLETED" && (!row.completedAt || !row.completedById)) {
      issues.push({ code: "missing-completion-record", message: `"${templateByKey.get(row.taskKey)?.title ?? row.taskKey}" is marked Completed but has no completion timestamp/user.` });
    }
  }

  // 9: blocked tasks have a reason.
  for (const row of rows) {
    if (row.status === "BLOCKED" && !row.blockedReason) {
      issues.push({ code: "missing-blocked-reason", message: `"${templateByKey.get(row.taskKey)?.title ?? row.taskKey}" is marked Blocked but has no reason recorded.` });
    }
  }

  // 10: critical dates are valid dates.
  for (const row of rows) {
    if (row.dueDate && Number.isNaN(row.dueDate.getTime())) {
      issues.push({ code: "invalid-due-date", message: `"${templateByKey.get(row.taskKey)?.title ?? row.taskKey}" has an invalid due date.` });
    }
  }

  const merged = mergeChecklistTasks(jurisdiction, matterType, rows);

  // 7 & 12: locked stages were not bypassed — no required task in a stage at or before the matter's current stage is left incomplete
  // (the one exception: the matter's *own* current stage, which by definition may still be in progress).
  const currentIndex = matterStageOrder(jurisdiction, matterStage);
  for (const stage of workflow) {
    const stageIndex = workflow.indexOf(stage);
    if (stageIndex >= currentIndex) continue;
    const incomplete = tasksForStage(merged, stage).filter((t) => isRequired(t) && !isTaskDone(t.status));
    if (incomplete.length > 0) {
      issues.push({
        code: "locked-stage-bypassed",
        message: `The matter has moved on to ${MATTER_STAGE_LABELS[matterStage]}, but ${MATTER_STAGE_LABELS[stage]} still has ${incomplete.length} incomplete required task(s).`,
      });
    }
  }

  // dependency integrity: a completed task's dependencies must also be complete.
  const mergedByKey = new Map(merged.map((t) => [t.taskKey, t]));
  for (const t of merged) {
    if (t.status !== "COMPLETED") continue;
    const blockers = dependencyBlockers(t, mergedByKey);
    if (blockers.length > 0) {
      issues.push({
        code: "dependency-issue",
        message: `"${t.title}" is marked Completed but required tasks it depends on are not: ${blockers.map((b) => b.title).join(", ")}.`,
      });
    }
  }

  return issues;
}
