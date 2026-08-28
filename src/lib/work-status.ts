/**
 * Work Status — pure logic shared by the VA dashboard, the Admin dashboard,
 * and the server actions. No I/O, no session, so it is cheap to test
 * exhaustively (see tests/unit/work-status.test.ts) and safe to import from
 * both server and client components.
 */

import type { WorkPriority, WorkStatus } from "@prisma/client";

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  WAITING_PENDING: "Waiting / Pending",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
};

export const WORK_PRIORITY_LABELS: Record<WorkPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const WORK_STATUS_VALUES = Object.keys(WORK_STATUS_LABELS) as WorkStatus[];
export const WORK_PRIORITY_VALUES = Object.keys(WORK_PRIORITY_LABELS) as WorkPriority[];

/**
 * Sensible status transitions (spec section 26). `from === to` is always
 * allowed — that is a plain edit or a note, not a transition, and is logged
 * to WorkActivity the same way with previousStatus equal to newStatus.
 */
const ALLOWED_TRANSITIONS: Record<WorkStatus, WorkStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["WAITING_PENDING", "BLOCKED", "COMPLETED"],
  WAITING_PENDING: ["IN_PROGRESS", "BLOCKED", "COMPLETED"],
  BLOCKED: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: ["IN_PROGRESS"],
};

export function isValidStatusTransition(from: WorkStatus, to: WorkStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Blocked work must always carry a reason (spec section 8). */
export function needsBlockedReason(status: WorkStatus): boolean {
  return status === "BLOCKED";
}

export function summarizeStatuses(items: { status: WorkStatus }[]): Record<WorkStatus, number> {
  const counts: Record<WorkStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    WAITING_PENDING: 0,
    BLOCKED: 0,
    COMPLETED: 0,
  };
  for (const item of items) counts[item.status]++;
  return counts;
}

/**
 * The org runs out of Queensland; "today" for the daily/team summaries means
 * the Australia/Brisbane calendar day (no DST, so this never shifts under
 * daylight saving), regardless of the server's or a browser's local zone.
 */
export const APP_TIMEZONE = "Australia/Brisbane";

export function dayKey(date: Date, timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isSameAppDay(a: Date, b: Date, timeZone: string = APP_TIMEZONE): boolean {
  return dayKey(a, timeZone) === dayKey(b, timeZone);
}

export type DailySummary = {
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  totalUpdates: number;
  firstUpdateAt: Date | null;
  lastUpdateAt: Date | null;
};

/**
 * Today's Summary / Team Activity Today (spec sections 18-19). `items` are a
 * user's current (non-deleted) work items; `activityToday` are the
 * WorkActivity rows already filtered to the app-timezone "today". "Completed"
 * counts items finished *today* specifically — In Progress/Pending/Blocked
 * are instantaneous current-state counts. This is strictly a visibility
 * count, never a productivity score (spec section 33).
 */
export function computeDailySummary(
  items: { status: WorkStatus; completedAt: Date | null }[],
  activityToday: { createdAt: Date }[],
  now: Date = new Date(),
): DailySummary {
  const counts = summarizeStatuses(items);
  const completedToday = items.filter(
    (i) => i.status === "COMPLETED" && i.completedAt && isSameAppDay(i.completedAt, now),
  ).length;
  const timestamps = activityToday.map((a) => a.createdAt).sort((a, b) => a.getTime() - b.getTime());

  return {
    completed: completedToday,
    inProgress: counts.IN_PROGRESS,
    pending: counts.WAITING_PENDING + counts.NOT_STARTED,
    blocked: counts.BLOCKED,
    totalUpdates: timestamps.length,
    firstUpdateAt: timestamps[0] ?? null,
    lastUpdateAt: timestamps[timestamps.length - 1] ?? null,
  };
}

/**
 * "No Recent Update" (spec section 20) — neutral visibility, not a
 * performance judgement: true when a VA has not posted any activity today.
 */
export function hasNoRecentUpdate(lastUpdateAt: Date | null, now: Date = new Date()): boolean {
  if (!lastUpdateAt) return true;
  return !isSameAppDay(lastUpdateAt, now);
}

export type VaState = "working" | "blocked" | "pending" | "idle";

/**
 * Buckets a VA into exactly one state from their current work items, for the
 * Admin overview counts (spec section 10: "8 VAs / 5 Working / 2 Pending /
 * 1 Blocked" always sums to the total). A VA can have several matters open
 * at once, so this is a priority order over their whole set, not a
 * reflection of a single active task: any in-progress matter wins, then a
 * blocker, then anything queued.
 */
export function classifyVaState(items: { status: WorkStatus }[]): VaState {
  if (items.some((i) => i.status === "IN_PROGRESS")) return "working";
  if (items.some((i) => i.status === "BLOCKED")) return "blocked";
  if (items.some((i) => i.status === "NOT_STARTED" || i.status === "WAITING_PENDING")) return "pending";
  return "idle";
}

/**
 * The single item a table row or admin summary should represent for a VA who
 * has no in-progress matter: the most recently touched blocker, else (unless
 * `includeQueued` is false) the most recently touched queued item, else
 * null. A table row can only show one line per VA, so this is a "what's most
 * worth surfacing" pick, not a claim that it's their only open matter — see
 * `pickCurrentItems` for the VA's own dashboard, which shows all of them.
 */
export function pickRepresentativeItem<T extends { status: WorkStatus; updatedAt: Date }>(
  items: T[],
  { includeQueued = true }: { includeQueued?: boolean } = {},
): T | null {
  const inProgress = items.find((i) => i.status === "IN_PROGRESS");
  if (inProgress) return inProgress;

  const byRecency = (a: T, b: T) => b.updatedAt.getTime() - a.updatedAt.getTime();

  const blocked = items.filter((i) => i.status === "BLOCKED").sort(byRecency)[0];
  if (blocked) return blocked;

  if (!includeQueued) return null;

  const queued = items
    .filter((i) => i.status === "NOT_STARTED" || i.status === "WAITING_PENDING")
    .sort(byRecency)[0];
  return queued ?? null;
}

/**
 * Every matter a VA should see spotlighted in "Currently Working On": a VA
 * can have several matters in progress at once (there is no one-active-task
 * limit), so this returns all of them, most recently updated first — one
 * card each, matching the shape of the cards used across the rest of the
 * app (the Programs grid, the trainee dashboard's course cards). A VA with
 * nothing in progress still needs their blockers surfaced (they're still
 * dealing with those), so this falls back to every blocked matter; a queued
 * item they haven't touched yet is not "current work" and stays out of this
 * list — it belongs in My Work / Pending instead.
 */
export function pickCurrentItems<T extends { status: WorkStatus; updatedAt: Date }>(items: T[]): T[] {
  const byRecency = (a: T, b: T) => b.updatedAt.getTime() - a.updatedAt.getTime();
  const inProgress = items.filter((i) => i.status === "IN_PROGRESS").sort(byRecency);
  if (inProgress.length > 0) return inProgress;
  return items.filter((i) => i.status === "BLOCKED").sort(byRecency);
}
