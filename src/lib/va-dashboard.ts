/**
 * VA Dashboard — pure composition logic over the VA's own existing domain
 * (matters, checklists, settlement calculations). No I/O, no session, so it
 * is cheap to test exhaustively and safe to import from both server and
 * client components, matching the pattern of work-status.ts/checklist.ts.
 *
 * Deliberately does not touch the Trainee course/lesson/journey system —
 * /va and /app stay two separate experiences (see src/app/va/page.tsx's own
 * comment history). Everything here is built from WorkItem, ChecklistTask
 * and SettlementCalculation data the VA dashboard already has.
 */

import { summarizeProgress, nextRequiredAction, type ChecklistTaskView, type ProgressSummary } from "@/lib/checklist";
import { JURISDICTION_VALUES, MATTER_STAGE_LABELS, matterStageOrder } from "@/lib/matter-stage";
import { WORK_STATUS_LABELS } from "@/lib/work-status";
import { formatAUD } from "@/lib/settlement/money";
import type { ChecklistTaskStatus, Jurisdiction, MatterStage, WorkStatus } from "@prisma/client";

/** Every jurisdiction the VA actually has a matter in, in JURISDICTION_VALUES order — never mixed into one blended figure (spec: QLD and NSW progress must stay distinguishable). */
export function workedJurisdictions(items: { jurisdiction: Jurisdiction }[]): Jurisdiction[] {
  const present = new Set(items.map((i) => i.jurisdiction));
  return JURISDICTION_VALUES.filter((j) => present.has(j));
}

export type MatterProgressInput = {
  matterId: string;
  matterTitle: string;
  tasks: { status: ChecklistTaskStatus }[];
};

export type MatterProgressSummary = ProgressSummary & { matterId: string; matterTitle: string };

/**
 * "Production Progress" (spec section 2's "Training Progress", reinterpreted
 * for a VA's real domain): the percentage of checklist tasks marked
 * Completed or Not Applicable, summed across every one of the VA's
 * currently open matters, divided by the total tasks across those same
 * matters — task-weighted, not matter-averaged, so a 1-task matter and a
 * 40-task matter don't count equally. `matters` should already be scoped to
 * open (non-COMPLETED, non-deleted) matters by the caller — this function
 * does not itself filter by matter status, only sums what it's given.
 */
export function summarizeMatterProgress(matters: MatterProgressInput[]): {
  overall: ProgressSummary;
  byMatter: MatterProgressSummary[];
} {
  const allTasks = matters.flatMap((m) => m.tasks);
  return {
    overall: summarizeProgress(allTasks),
    byMatter: matters.map((m) => ({ ...summarizeProgress(m.tasks), matterId: m.matterId, matterTitle: m.matterTitle })),
  };
}

export type NextActionMatterInput = {
  matterId: string;
  matterTitle: string;
  jurisdiction: Jurisdiction;
  matterStage: MatterStage;
  workStatus: WorkStatus;
  tasks: ChecklistTaskView[];
};

export type PrimaryNextAction = { matterId: string; matterTitle: string; task: ChecklistTaskView };

const NEXT_ACTION_PRIORITY: Record<WorkStatus, number> = {
  IN_PROGRESS: 0,
  BLOCKED: 1,
  WAITING_PENDING: 2,
  NOT_STARTED: 2,
  COMPLETED: 99,
};

/**
 * The single most relevant next checklist task across *all* of the VA's
 * matters — not just the spotlighted (in-progress/blocked) ones each
 * CurrentTaskCard already shows its own "Next Required Action" for. An
 * in-progress matter's action wins over a blocked matter's, which wins over
 * a queued matter's; ties broken by earliest matter-stage order (the matter
 * further along is more time-sensitive). Returns null when no matter
 * actually has an outstanding required task — never a fabricated pick.
 */
export function pickPrimaryNextAction(matters: NextActionMatterInput[]): PrimaryNextAction | null {
  const candidates = matters
    .filter((m) => m.workStatus !== "COMPLETED")
    .map((m) => ({ m, task: nextRequiredAction(m.jurisdiction, m.tasks, m.matterStage) }))
    .filter((c): c is { m: NextActionMatterInput; task: ChecklistTaskView } => c.task !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const priorityDiff = NEXT_ACTION_PRIORITY[a.m.workStatus] - NEXT_ACTION_PRIORITY[b.m.workStatus];
    if (priorityDiff !== 0) return priorityDiff;
    return matterStageOrder(a.m.jurisdiction, a.m.matterStage) - matterStageOrder(b.m.jurisdiction, b.m.matterStage);
  });

  const picked = candidates[0];
  return { matterId: picked.m.matterId, matterTitle: picked.m.matterTitle, task: picked.task };
}

export type RecentActivityEntry = {
  key: string;
  kind: "status-change" | "stage-change" | "calc-created" | "calc-finalised";
  matterTitle: string;
  when: Date;
  detail: string;
};

export type WorkActivityLike = {
  id: string;
  matterTitle: string;
  previousStatus: WorkStatus;
  newStatus: WorkStatus;
  previousMatterStage: MatterStage | null;
  newMatterStage: MatterStage | null;
  note: string | null;
  createdAt: Date;
};

export type SettlementCalculationLike = {
  id: string;
  matterTitle: string;
  status: "DRAFT" | "FINALISED";
  createdAt: Date;
  finalisedAt: Date | null;
  settlementAmountCents: number | null;
};

/**
 * Real recent activity (spec section 14) — merges matter status/stage
 * changes with settlement-calculation events into one chronological feed,
 * most recent first. Never fabricated: an empty input produces an empty
 * feed, not placeholder entries.
 */
export function buildRecentActivityFeed(
  activity: WorkActivityLike[],
  calculations: SettlementCalculationLike[],
  limit = 10,
): RecentActivityEntry[] {
  const fromActivity: RecentActivityEntry[] = activity.map((a) => {
    if (a.previousMatterStage && a.newMatterStage && a.previousMatterStage !== a.newMatterStage) {
      return {
        key: a.id,
        kind: "stage-change",
        matterTitle: a.matterTitle,
        when: a.createdAt,
        detail: `${MATTER_STAGE_LABELS[a.previousMatterStage]} → ${MATTER_STAGE_LABELS[a.newMatterStage]}`,
      };
    }
    if (a.previousStatus !== a.newStatus) {
      return {
        key: a.id,
        kind: "status-change",
        matterTitle: a.matterTitle,
        when: a.createdAt,
        detail: `${WORK_STATUS_LABELS[a.previousStatus]} → ${WORK_STATUS_LABELS[a.newStatus]}`,
      };
    }
    return {
      key: a.id,
      kind: "status-change",
      matterTitle: a.matterTitle,
      when: a.createdAt,
      detail: a.note ?? "Updated",
    };
  });

  const fromCalculations: RecentActivityEntry[] = calculations.map((c) =>
    c.status === "FINALISED" && c.finalisedAt
      ? {
          key: c.id,
          kind: "calc-finalised",
          matterTitle: c.matterTitle,
          when: c.finalisedAt,
          detail: `Settlement calculation finalised — ${formatAUD(c.settlementAmountCents)}`,
        }
      : {
          key: c.id,
          kind: "calc-created",
          matterTitle: c.matterTitle,
          when: c.createdAt,
          detail: "Settlement calculation started",
        },
  );

  return [...fromActivity, ...fromCalculations].sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, limit);
}
