/**
 * Shared tiered-message helpers used by every adjustment category, so
 * "no duplicated formulas" extends to the messages themselves — overlap/gap
 * detection and figure-reconciliation warnings are written once here, not
 * once per category.
 */

import { compareIsoDates, daysExclusive, isValidIsoDate, type IsoDate } from "./dates";
import { type Cents, formatAUD } from "./money";
import type { AdjustmentMessage } from "./types";

export function info(text: string): AdjustmentMessage {
  return { tier: "info", text };
}
export function warning(text: string): AdjustmentMessage {
  return { tier: "warning", text };
}
export function error(text: string): AdjustmentMessage {
  return { tier: "error", text };
}

/** Worst tier present, or "ok" if the list is empty / has no error|warning. */
export function worstTier(messages: AdjustmentMessage[]): "ok" | "info" | "warning" | "error" {
  if (messages.some((m) => m.tier === "error")) return "error";
  if (messages.some((m) => m.tier === "warning")) return "warning";
  if (messages.some((m) => m.tier === "info")) return "info";
  return "ok";
}

/**
 * Flags when a manually-entered reference figure (e.g. off a PEXA workspace
 * or a solicitor's letter) doesn't match what this engine calculated.
 * Deliberately doesn't say which figure is "right" — a mismatch is always a
 * flag-for-review, never a silent tie-break in either direction.
 */
export function reconcileAgainstFigure(
  calculated: Cents,
  entered: Cents | null,
  label: string,
): AdjustmentMessage | null {
  if (entered === null || entered === calculated) return null;
  return warning(
    `Doesn't reconcile with the ${label} figure entered (${formatAUD(entered)} vs calculated ${formatAUD(calculated)}) — flag for review rather than defer to either number.`,
  );
}

/* ------------------------------------------------------------------ */
/* Overlap / gap detection across same-category+label period items     */
/* ------------------------------------------------------------------ */

export interface PeriodItem {
  id: string;
  category: string;
  label: string;
  periodStart: IsoDate | null;
  periodEnd: IsoDate | null;
  /** e.g. a "notice not yet received" item has no period to compare — exclude it. */
  excludeFromOverlapCheck?: boolean;
}

function groupKey(item: PeriodItem): string {
  return `${item.category}::${item.label.trim().toLowerCase()}`;
}

function findOverlapsAndGapsWithinGroup(items: PeriodItem[]): Map<string, AdjustmentMessage[]> {
  const messagesById = new Map<string, AdjustmentMessage[]>();
  const withDates = items
    .filter(
      (i) =>
        !i.excludeFromOverlapCheck &&
        isValidIsoDate(i.periodStart) &&
        isValidIsoDate(i.periodEnd) &&
        compareIsoDates(i.periodEnd!, i.periodStart!) >= 0,
    )
    .sort((a, b) => compareIsoDates(a.periodStart!, b.periodStart!));

  const push = (id: string, msg: AdjustmentMessage) => {
    const list = messagesById.get(id) ?? [];
    list.push(msg);
    messagesById.set(id, list);
  };

  for (let i = 0; i < withDates.length - 1; i++) {
    const current = withDates[i];
    const next = withDates[i + 1];
    if (compareIsoDates(next.periodStart!, current.periodEnd!) <= 0) {
      const label = current.label || current.category;
      push(current.id, warning(`Overlaps with another ${label} item (${next.periodStart} – ${next.periodEnd}) — check you haven't double-counted.`));
      push(next.id, warning(`Overlaps with another ${label} item (${current.periodStart} – ${current.periodEnd}) — check you haven't double-counted.`));
    } else {
      // The gap between two periods is elapsed time between a boundary the
      // seller-side period owns and a boundary the next period owns, not a
      // period anyone owns itself — so this is exclusive, per dates.ts's
      // convention, not inclusive. Back-to-back periods (next starts the
      // day after current ends) must produce zero, not one.
      const gapDays = daysExclusive(current.periodEnd!, next.periodStart!) - 1;
      if (gapDays > 0) {
        const label = current.label || current.category;
        push(next.id, warning(`There's a ${gapDays}-day gap between this item and the previous ${label} item — you may be missing a notice for that period.`));
      }
    }
  }
  return messagesById;
}

/**
 * Checks every same-category+label group in `items` for overlapping or
 * gapped periods. Different categories (or differently-labelled items
 * within a category, e.g. admin fund vs sinking fund) are kept apart and
 * never cross-warn each other.
 */
export function findOverlapsAndGaps(items: PeriodItem[]): Map<string, AdjustmentMessage[]> {
  const groups = new Map<string, PeriodItem[]>();
  for (const item of items) {
    const key = groupKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const result = new Map<string, AdjustmentMessage[]>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const [id, messages] of findOverlapsAndGapsWithinGroup(group)) {
      result.set(id, messages);
    }
  }
  return result;
}
