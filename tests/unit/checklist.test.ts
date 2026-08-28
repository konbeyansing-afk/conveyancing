/**
 * Checklist — pure logic. Progress, stage gating, dependencies, and the
 * Matter Health validator, all exercised without a database.
 */

import { describe, expect, it } from "vitest";
import {
  type ChecklistTaskRow,
  dependencyBlockers,
  isTaskDone,
  isTaskUnlocked,
  mergeChecklistTasks,
  nextRequiredAction,
  stageGateResult,
  stagesWithTasks,
  summarizeProgress,
  tasksForStage,
  validateChecklist,
} from "@/lib/checklist";
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

function fullRows(jurisdiction: "QLD" | "NSW", matterType: "PURCHASE" | "SALE"): ChecklistTaskRow[] {
  return checklistTemplate(jurisdiction, matterType).map((t) => rowFor(t.key));
}

describe("isTaskDone", () => {
  it("Completed and Not Applicable count as done, nothing else does", () => {
    expect(isTaskDone("COMPLETED")).toBe(true);
    expect(isTaskDone("NOT_APPLICABLE")).toBe(true);
    expect(isTaskDone("NOT_STARTED")).toBe(false);
    expect(isTaskDone("IN_PROGRESS")).toBe(false);
    expect(isTaskDone("BLOCKED")).toBe(false);
    expect(isTaskDone("WAITING_PENDING")).toBe(false);
  });
});

describe("mergeChecklistTasks", () => {
  it("merges a row with its template definition", () => {
    const rows = [rowFor("qp-title-search", { status: "COMPLETED" })];
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    expect(views).toHaveLength(1);
    expect(views[0].title).toBe("Title Search");
    expect(views[0].status).toBe("COMPLETED");
  });

  it("drops a row whose key is not in the template rather than crashing", () => {
    const rows = [rowFor("not-a-real-key")];
    expect(mergeChecklistTasks("QLD", "PURCHASE", rows)).toEqual([]);
  });

  it("returns nothing for a null matterType", () => {
    expect(mergeChecklistTasks("QLD", null, [rowFor("qp-title-search")])).toEqual([]);
  });
});

describe("summarizeProgress", () => {
  it("is 0/0/0% for no tasks", () => {
    expect(summarizeProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it("counts Completed and Not Applicable toward completion", () => {
    const tasks = [{ status: "COMPLETED" as const }, { status: "NOT_APPLICABLE" as const }, { status: "IN_PROGRESS" as const }];
    expect(summarizeProgress(tasks)).toEqual({ completed: 2, total: 3, percent: 67 });
  });
});

describe("stagesWithTasks", () => {
  it("only lists stages that actually have a task, in workflow order", () => {
    const views = mergeChecklistTasks("QLD", "PURCHASE", fullRows("QLD", "PURCHASE"));
    const stages = stagesWithTasks("QLD", views);
    expect(stages).toContain("MATTER_OPENING");
    expect(stages).toContain("PEXA");
    // COMPLETED is the final workflow stage and has no checklist tasks of its own.
    expect(stages).not.toContain("COMPLETED");
    // Ordering matches the jurisdiction's own workflow.
    expect(stages.indexOf("MATTER_OPENING")).toBeLessThan(stages.indexOf("PEXA"));
  });
});

describe("dependencyBlockers / isTaskUnlocked", () => {
  it("a task with no dependencies is always unlocked", () => {
    const rows = fullRows("QLD", "PURCHASE");
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    const byKey = new Map(views.map((v) => [v.taskKey, v]));
    const task = byKey.get("qp-title-search")!;
    expect(dependencyBlockers(task, byKey)).toEqual([]);
    expect(isTaskUnlocked(task, byKey)).toBe(true);
  });

  it("Sign PEXA Workspace is locked until its dependencies are done (spec section 9's own example)", () => {
    const rows = fullRows("QLD", "PURCHASE");
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    const byKey = new Map(views.map((v) => [v.taskKey, v]));
    const signWorkspace = byKey.get("qp-pexa-sign-workspace")!;

    expect(isTaskUnlocked(signWorkspace, byKey)).toBe(false);
    const blockers = dependencyBlockers(signWorkspace, byKey);
    expect(blockers.map((b) => b.title)).toContain("Accept PEXA Workspace Invitation from PSOL");

    // Complete every dependency and it unlocks.
    const doneRows = rows.map((r) =>
      ["qp-pexa-accept-invite", "qp-pexa-verify-parties", "qp-pexa-verify-mortgagee", "qp-pexa-sign-caf"].includes(r.taskKey)
        ? { ...r, status: "COMPLETED" as const }
        : r,
    );
    const doneViews = mergeChecklistTasks("QLD", "PURCHASE", doneRows);
    const doneByKey = new Map(doneViews.map((v) => [v.taskKey, v]));
    expect(isTaskUnlocked(doneByKey.get("qp-pexa-sign-workspace")!, doneByKey)).toBe(true);
  });

  it("a Not Applicable dependency counts as satisfied", () => {
    const rows = fullRows("QLD", "SALE").map((r) =>
      r.taskKey === "qv-parties-active" ? { ...r, status: "NOT_APPLICABLE" as const } : r,
    );
    const views = mergeChecklistTasks("QLD", "SALE", rows);
    const byKey = new Map(views.map((v) => [v.taskKey, v]));
    expect(isTaskUnlocked(byKey.get("qv-nomination")!, byKey)).toBe(true);
  });
});

describe("stageGateResult — spec section 8", () => {
  it("blocks moving forward while the current stage has incomplete required tasks", () => {
    const rows = fullRows("QLD", "PURCHASE");
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    const gate = stageGateResult("QLD", views, "MATTER_OPENING", "CONTRACT_SIGNED");
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.blockingStage).toBe("MATTER_OPENING");
  });

  it("allows moving forward once every required task up to the target is done", () => {
    const template = checklistTemplate("QLD", "PURCHASE");
    const rows = template.map((t) =>
      rowFor(t.key, { status: t.stage === "MATTER_OPENING" && t.required !== false ? "COMPLETED" : "NOT_STARTED" }),
    );
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    const gate = stageGateResult("QLD", views, "MATTER_OPENING", "CONTRACT_SIGNED");
    expect(gate.allowed).toBe(true);
  });

  it("never blocks moving backward", () => {
    const rows = fullRows("QLD", "PURCHASE");
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    const gate = stageGateResult("QLD", views, "PEXA", "MATTER_OPENING");
    expect(gate.allowed).toBe(true);
  });

  it("optional (not required) tasks never block a stage", () => {
    const template = checklistTemplate("QLD", "PURCHASE");
    const rows = template.map((t) => {
      if (t.stage !== "MATTER_OPENING") return rowFor(t.key);
      // Complete every required task in the stage, leave optional ones untouched.
      return rowFor(t.key, { status: t.required === false ? "NOT_STARTED" : "COMPLETED" });
    });
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    const gate = stageGateResult("QLD", views, "MATTER_OPENING", "CONTRACT_SIGNED");
    expect(gate.allowed).toBe(true);
  });
});

describe("nextRequiredAction", () => {
  it("returns the first incomplete required task in the current stage", () => {
    const rows = fullRows("QLD", "PURCHASE");
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    const action = nextRequiredAction("QLD", views, "MATTER_OPENING");
    expect(action?.title).toBe("Complete Matter Details & Verify QLD REIQ Contract Version");
  });

  it("falls back to the earliest stage with an outstanding required task", () => {
    const template = checklistTemplate("QLD", "PURCHASE");
    const rows = template.map((t) =>
      rowFor(t.key, { status: t.stage === "MATTER_OPENING" ? "COMPLETED" : "NOT_STARTED" }),
    );
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    // The matter's own current stage (MATTER_OPENING) is clear, so this looks further ahead.
    const action = nextRequiredAction("QLD", views, "MATTER_OPENING");
    expect(action).not.toBeNull();
    expect(action?.stage).not.toBe("MATTER_OPENING");
  });

  it("returns null once every required task everywhere is done", () => {
    const template = checklistTemplate("QLD", "PURCHASE");
    const rows = template.map((t) => rowFor(t.key, { status: "COMPLETED" }));
    const views = mergeChecklistTasks("QLD", "PURCHASE", rows);
    expect(nextRequiredAction("QLD", views, "MATTER_OPENING")).toBeNull();
  });
});

describe("validateChecklist — Matter Health", () => {
  it("is clean for a freshly instantiated checklist", () => {
    const rows = fullRows("QLD", "PURCHASE");
    expect(validateChecklist("QLD", "PURCHASE", "MATTER_OPENING", rows)).toEqual([]);
  });

  it("flags a task whose key belongs to a different jurisdiction's template", () => {
    const rows = [...fullRows("NSW", "PURCHASE"), rowFor("qp-title-search")];
    const issues = validateChecklist("NSW", "PURCHASE", "MATTER_OPENING", rows);
    expect(issues.some((i) => i.code === "wrong-template")).toBe(true);
  });

  it("flags a duplicate task", () => {
    const dupRows = [rowFor("qv-matter-details"), rowFor("qv-matter-details")];
    const issues = validateChecklist("QLD", "SALE", "MATTER_OPENING", dupRows);
    expect(issues.some((i) => i.code === "duplicate-task")).toBe(true);
  });

  it("flags a Completed task with no completion record", () => {
    const rows = fullRows("QLD", "PURCHASE").map((r) =>
      r.taskKey === "qp-title-search" ? { ...r, status: "COMPLETED" as const } : r,
    );
    const issues = validateChecklist("QLD", "PURCHASE", "MATTER_OPENING", rows);
    expect(issues.some((i) => i.code === "missing-completion-record")).toBe(true);
  });

  it("does not flag a Completed task that does have a completion record", () => {
    const rows = fullRows("QLD", "PURCHASE").map((r) =>
      r.taskKey === "qp-title-search"
        ? { ...r, status: "COMPLETED" as const, completedAt: new Date(), completedById: "user-1" }
        : r,
    );
    const issues = validateChecklist("QLD", "PURCHASE", "MATTER_OPENING", rows);
    expect(issues.some((i) => i.code === "missing-completion-record")).toBe(false);
  });

  it("flags a Blocked task with no reason", () => {
    const rows = fullRows("QLD", "PURCHASE").map((r) =>
      r.taskKey === "qp-title-search" ? { ...r, status: "BLOCKED" as const } : r,
    );
    const issues = validateChecklist("QLD", "PURCHASE", "MATTER_OPENING", rows);
    expect(issues.some((i) => i.code === "missing-blocked-reason")).toBe(true);
  });

  it("flags a locked stage that was bypassed — the matter moved on while an earlier required task is still open", () => {
    // Matter says it's at PRE_SETTLEMENT, but nothing in MATTER_OPENING was ever done.
    const rows = fullRows("QLD", "PURCHASE");
    const issues = validateChecklist("QLD", "PURCHASE", "PRE_SETTLEMENT", rows);
    expect(issues.some((i) => i.code === "locked-stage-bypassed")).toBe(true);
  });

  it("flags a Completed task whose dependency is not itself complete", () => {
    const rows = fullRows("QLD", "PURCHASE").map((r) =>
      r.taskKey === "qp-pexa-sign-workspace"
        ? { ...r, status: "COMPLETED" as const, completedAt: new Date(), completedById: "user-1" }
        : r,
    );
    const issues = validateChecklist("QLD", "PURCHASE", "PEXA", rows);
    expect(issues.some((i) => i.code === "dependency-issue")).toBe(true);
  });

  it("tasksForStage returns only that stage's tasks", () => {
    const views = mergeChecklistTasks("QLD", "PURCHASE", fullRows("QLD", "PURCHASE"));
    const pexaTasks = tasksForStage(views, "PEXA");
    expect(pexaTasks.length).toBeGreaterThan(0);
    expect(pexaTasks.every((t) => t.stage === "PEXA")).toBe(true);
  });
});
