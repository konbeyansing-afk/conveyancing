/**
 * VA Dashboard — pure composition logic over the VA's own matters,
 * checklists and settlement calculations. No database.
 */

import { describe, expect, it } from "vitest";
import {
  buildRecentActivityFeed,
  pickPrimaryNextAction,
  summarizeMatterProgress,
  workedJurisdictions,
  type NextActionMatterInput,
  type SettlementCalculationLike,
  type WorkActivityLike,
} from "@/lib/va-dashboard";
import { mergeChecklistTasks, type ChecklistTaskRow } from "@/lib/checklist";
import { checklistTemplate } from "@/lib/checklist-templates";

function rowFor(taskKey: string, overrides: Partial<ChecklistTaskRow> = {}): ChecklistTaskRow {
  return {
    id: taskKey,
    taskKey,
    status: "NOT_STARTED",
    notes: null,
    blockedReason: null,
    dueDate: null,
    completedAt: null,
    completedById: null,
    assignedToId: null,
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  };
}

/** Every task in a jurisdiction/matterType's template, all Completed except `except`. */
function tasksMostlyDone(jurisdiction: "QLD" | "NSW", matterType: "PURCHASE" | "SALE", except: string[]) {
  const rows = checklistTemplate(jurisdiction, matterType).map((t) =>
    rowFor(t.key, except.includes(t.key) ? {} : { status: "COMPLETED", completedAt: new Date(), completedById: "u1" }),
  );
  return mergeChecklistTasks(jurisdiction, matterType, rows);
}

describe("workedJurisdictions", () => {
  it("returns nothing for no matters", () => {
    expect(workedJurisdictions([])).toEqual([]);
  });

  it("returns just QLD when every matter is QLD", () => {
    expect(workedJurisdictions([{ jurisdiction: "QLD" }, { jurisdiction: "QLD" }])).toEqual(["QLD"]);
  });

  it("returns both, in a stable order, never merged into one figure", () => {
    expect(workedJurisdictions([{ jurisdiction: "NSW" }, { jurisdiction: "QLD" }])).toEqual(["QLD", "NSW"]);
  });

  it("collapses duplicates", () => {
    const items = [{ jurisdiction: "QLD" as const }, { jurisdiction: "QLD" as const }, { jurisdiction: "NSW" as const }];
    expect(workedJurisdictions(items)).toEqual(["QLD", "NSW"]);
  });
});

describe("summarizeMatterProgress", () => {
  it("is empty for no matters", () => {
    expect(summarizeMatterProgress([])).toEqual({ overall: { completed: 0, total: 0, percent: 0 }, byMatter: [] });
  });

  it("is task-weighted across matters, not an average of each matter's own percentage", () => {
    // Matter A: 1/1 done (100%). Matter B: 1/10 done (10%). A naive average
    // of the two percentages would be 55% — the real, task-weighted figure
    // is 2/11 (~18%).
    const a = { matterId: "a", matterTitle: "Matter A", tasks: [{ status: "COMPLETED" as const }] };
    const b = {
      matterId: "b",
      matterTitle: "Matter B",
      tasks: [
        { status: "COMPLETED" as const },
        ...Array.from({ length: 9 }, () => ({ status: "NOT_STARTED" as const })),
      ],
    };
    const result = summarizeMatterProgress([a, b]);
    expect(result.overall).toEqual({ completed: 2, total: 11, percent: 18 });
    expect(result.byMatter).toEqual([
      { matterId: "a", matterTitle: "Matter A", completed: 1, total: 1, percent: 100 },
      { matterId: "b", matterTitle: "Matter B", completed: 1, total: 10, percent: 10 },
    ]);
  });

  it("counts Not Applicable as done, same as Completed", () => {
    const result = summarizeMatterProgress([
      { matterId: "a", matterTitle: "A", tasks: [{ status: "NOT_APPLICABLE" }, { status: "NOT_STARTED" }] },
    ]);
    expect(result.overall).toEqual({ completed: 1, total: 2, percent: 50 });
  });
});

describe("pickPrimaryNextAction", () => {
  function matter(overrides: Partial<NextActionMatterInput>): NextActionMatterInput {
    return {
      matterId: "m",
      matterTitle: "Matter",
      jurisdiction: "QLD",
      matterStage: "MATTER_OPENING",
      workStatus: "IN_PROGRESS",
      tasks: tasksMostlyDone("QLD", "PURCHASE", ["qp-diary-dates"]),
      ...overrides,
    };
  }

  it("returns null when no matter has any outstanding required task", () => {
    const doneMatter = matter({ tasks: tasksMostlyDone("QLD", "PURCHASE", []) });
    expect(pickPrimaryNextAction([doneMatter])).toBeNull();
  });

  it("picks the in-progress matter's action over a blocked matter's", () => {
    const inProgress = matter({ matterId: "ip", matterTitle: "In Progress Matter", workStatus: "IN_PROGRESS" });
    const blocked = matter({
      matterId: "bl",
      matterTitle: "Blocked Matter",
      workStatus: "BLOCKED",
      tasks: tasksMostlyDone("QLD", "PURCHASE", ["qp-diary-dates"]),
    });
    const result = pickPrimaryNextAction([blocked, inProgress]);
    expect(result?.matterId).toBe("ip");
  });

  it("picks a blocked matter's action over a queued matter's", () => {
    const blocked = matter({ matterId: "bl", matterTitle: "Blocked Matter", workStatus: "BLOCKED" });
    const queued = matter({
      matterId: "q",
      matterTitle: "Queued Matter",
      workStatus: "NOT_STARTED",
      tasks: tasksMostlyDone("QLD", "PURCHASE", ["qp-diary-dates"]),
    });
    const result = pickPrimaryNextAction([queued, blocked]);
    expect(result?.matterId).toBe("bl");
  });

  it("never considers a completed matter", () => {
    const completed = matter({ matterId: "c", workStatus: "COMPLETED" });
    expect(pickPrimaryNextAction([completed])).toBeNull();
  });
});

describe("buildRecentActivityFeed", () => {
  function activity(overrides: Partial<WorkActivityLike>): WorkActivityLike {
    return {
      id: "a1",
      matterTitle: "Matter A",
      previousStatus: "NOT_STARTED",
      newStatus: "IN_PROGRESS",
      previousMatterStage: null,
      newMatterStage: null,
      note: null,
      createdAt: new Date("2026-03-01T09:00:00.000Z"),
      ...overrides,
    };
  }

  function calc(overrides: Partial<SettlementCalculationLike>): SettlementCalculationLike {
    return {
      id: "c1",
      matterTitle: "Matter B",
      status: "DRAFT",
      createdAt: new Date("2026-03-01T08:00:00.000Z"),
      finalisedAt: null,
      settlementAmountCents: null,
      ...overrides,
    };
  }

  it("is empty for no activity", () => {
    expect(buildRecentActivityFeed([], [])).toEqual([]);
  });

  it("merges and sorts both sources by recency, most recent first", () => {
    const older = activity({ id: "a1", createdAt: new Date("2026-03-01T08:00:00.000Z") });
    const newer = calc({ id: "c1", status: "FINALISED", finalisedAt: new Date("2026-03-01T10:00:00.000Z"), settlementAmountCents: 12345 });
    const result = buildRecentActivityFeed([older], [newer]);
    expect(result.map((r) => r.key)).toEqual(["c1", "a1"]);
    expect(result[0].kind).toBe("calc-finalised");
    expect(result[0].detail).toContain("$123.45");
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      activity({ id: `a${i}`, createdAt: new Date(2026, 2, 1, i) }),
    );
    expect(buildRecentActivityFeed(many, [], 5)).toHaveLength(5);
  });

  it("labels a stage change distinctly from a plain status change", () => {
    const stageChange = activity({
      id: "s1",
      previousMatterStage: "MATTER_OPENING",
      newMatterStage: "CONTRACT_REVIEW",
    });
    const [entry] = buildRecentActivityFeed([stageChange], []);
    expect(entry.kind).toBe("stage-change");
    expect(entry.detail).toBe("Matter Opening → Contract Review");
  });

  it("uses createdAt (not finalisedAt) for a still-draft calculation", () => {
    const draft = calc({ id: "d1", status: "DRAFT", createdAt: new Date("2026-03-01T07:00:00.000Z") });
    const [entry] = buildRecentActivityFeed([], [draft]);
    expect(entry.kind).toBe("calc-created");
    expect(entry.when).toEqual(draft.createdAt);
  });
});
