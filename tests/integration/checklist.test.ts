/**
 * Checklist, exercised through the real server actions against the real
 * database: checklist generation, status updates with dependency
 * enforcement, ownership, and stage gating wired into updateMatterStage.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertDatabaseReachable, cleanup, createUser } from "./helpers";
import { prisma } from "@/lib/prisma";

const session: { user: { id: string; name: string; email: string; role: string } | null } = {
  user: null,
};

vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const checklist = await import("@/lib/actions/checklist");
const workStatus = await import("@/lib/actions/work-status");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

let vaOne: Awaited<ReturnType<typeof createUser>>;
let vaTwo: Awaited<ReturnType<typeof createUser>>;
let admin: Awaited<ReturnType<typeof createUser>>;

const asVaOne = () => (session.user = { id: vaOne.id, name: vaOne.name, email: vaOne.email, role: "VA" });
const asVaTwo = () => (session.user = { id: vaTwo.id, name: vaTwo.name, email: vaTwo.email, role: "VA" });
const asAdmin = () => (session.user = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" });

beforeAll(async () => {
  await assertDatabaseReachable();
  vaOne = await createUser("VA", "checklist-one");
  vaTwo = await createUser("VA", "checklist-two");
  admin = await createUser("ADMIN", "checklist");
});

afterAll(async () => {
  await cleanup();
});

// ensureChecklistForWorkItem now requires a signed-in staff/VA session (see
// 06be82b), and every test below calls it before setting up the specific
// role its own action-under-test needs — so a valid default session must
// already exist beforehand. vaOne always owns the fixture matter, so VA is
// always an acceptable session for that first call; tests that need a
// different actor for the actual assertion still call asVaTwo()/asAdmin()
// afterward, overriding this default.
beforeEach(() => asVaOne());

describe("ensureChecklistForWorkItem", () => {
  it("generates the full QLD Purchaser checklist for a QLD/Purchase matter", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT QLD Purchase Checklist", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);

    const rows = await prisma.checklistTask.findMany({ where: { workItemId: item.id } });
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.every((r) => r.status === "NOT_STARTED")).toBe(true);
    expect(rows.some((r) => r.taskKey === "qp-title-search")).toBe(true);
    expect(rows.some((r) => r.taskKey.startsWith("nv-") || r.taskKey.startsWith("np-"))).toBe(false);
  });

  it("generates the NSW Vendor checklist for a NSW/Sale matter — different tasks from QLD", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT NSW Sale Checklist", jurisdiction: "NSW", matterType: "SALE", status: "NOT_STARTED", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);

    const rows = await prisma.checklistTask.findMany({ where: { workItemId: item.id } });
    expect(rows.length).toBeGreaterThan(30);
    expect(rows.some((r) => r.taskKey.startsWith("nv-"))).toBe(true);
    expect(rows.some((r) => r.taskKey.startsWith("qp-") || r.taskKey.startsWith("qv-"))).toBe(false);
  });

  it("is idempotent — calling it twice does not duplicate rows", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Idempotent Checklist", jurisdiction: "QLD", matterType: "SALE", status: "NOT_STARTED", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const firstCount = await prisma.checklistTask.count({ where: { workItemId: item.id } });
    await checklist.ensureChecklistForWorkItem(item.id);
    const secondCount = await prisma.checklistTask.count({ where: { workItemId: item.id } });
    expect(secondCount).toBe(firstCount);
  });

  it("creates nothing for a matter with no matterType set", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT No Matter Type", jurisdiction: "QLD", status: "NOT_STARTED", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const count = await prisma.checklistTask.count({ where: { workItemId: item.id } });
    expect(count).toBe(0);
  });
});

describe("updateChecklistTaskStatus", () => {
  it("lets a VA complete their own task, recording who and when", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Complete Own Task", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const task = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-title-search" } });

    asVaOne();
    const result = await checklist.updateChecklistTaskStatus(task.id, null, form({ status: "COMPLETED" }));
    expect(result).toEqual({ success: "Task updated." });

    const updated = await prisma.checklistTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.status).toBe("COMPLETED");
    expect(updated.completedAt).not.toBeNull();
    expect(updated.completedById).toBe(vaOne.id);
  });

  it("refuses a VA updating another VA's checklist task", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Not Your Task", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const task = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-title-search" } });

    asVaTwo();
    const result = await checklist.updateChecklistTaskStatus(task.id, null, form({ status: "COMPLETED" }));
    expect(result).toEqual({ error: "You can only update your own matter's checklist." });

    const untouched = await prisma.checklistTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(untouched.status).toBe("NOT_STARTED");
  });

  it("lets Admin update any VA's checklist task", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Admin Can Touch", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const task = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-title-search" } });

    asAdmin();
    const result = await checklist.updateChecklistTaskStatus(task.id, null, form({ status: "IN_PROGRESS" }));
    expect(result).toEqual({ success: "Task updated." });
  });

  it("requires a reason to mark a task Blocked", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Blocked Needs Reason", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const task = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-title-search" } });

    asVaOne();
    const result = await checklist.updateChecklistTaskStatus(task.id, null, form({ status: "BLOCKED" }));
    expect(result).toEqual({ error: "Blocked tasks need a reason." });
  });

  it("refuses to complete a task whose dependencies are not yet done (spec section 9's PEXA example)", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT PEXA Dependency", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const signWorkspace = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-pexa-sign-workspace" } });

    asVaOne();
    const result = await checklist.updateChecklistTaskStatus(signWorkspace.id, null, form({ status: "COMPLETED" }));
    expect(result).toMatchObject({ error: expect.stringContaining("Accept PEXA Workspace Invitation from PSOL") });

    const untouched = await prisma.checklistTask.findUniqueOrThrow({ where: { id: signWorkspace.id } });
    expect(untouched.status).toBe("NOT_STARTED");
  });

  it("allows completing that same task once its dependencies are all done", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT PEXA Dependency Cleared", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    asVaOne();
    for (const key of ["qp-pexa-accept-invite", "qp-pexa-verify-parties", "qp-pexa-verify-mortgagee", "qp-pexa-sign-caf"]) {
      const dep = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: key } });
      const depResult = await checklist.updateChecklistTaskStatus(dep.id, null, form({ status: "COMPLETED" }));
      expect(depResult).toEqual({ success: "Task updated." });
    }
    const signWorkspace = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-pexa-sign-workspace" } });
    const result = await checklist.updateChecklistTaskStatus(signWorkspace.id, null, form({ status: "COMPLETED" }));
    expect(result).toEqual({ success: "Task updated." });
  });
});

describe("updateChecklistTaskDetails", () => {
  it("saves a note on a task", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Task Note", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const task = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-title-search" } });

    asVaOne();
    const result = await checklist.updateChecklistTaskDetails(task.id, null, form({ notes: "Ordered via InfoTrack." }));
    expect(result).toEqual({ success: "Task details saved." });

    const updated = await prisma.checklistTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.notes).toBe("Ordered via InfoTrack.");
  });
});

describe("Stage gating wired into updateMatterStage", () => {
  it("refuses to move to the next stage while required tasks in the current stage are incomplete", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Gate Blocks", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);

    asAdmin();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "CONTRACT_SIGNED" }));
    expect(result).toMatchObject({ error: expect.stringContaining("Matter Opening") });

    const untouched = await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(untouched.matterStage).toBe("MATTER_OPENING");
  });

  it("allows the move once every required task in Matter Opening is complete", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Gate Clears", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);
    const openingRequired = await prisma.checklistTask.findMany({
      where: { workItemId: item.id, taskKey: { in: ["qp-matter-details", "qp-form2", "qp-form2-certs", "qp-title-search", "qp-rp", "qp-pool-safety", "qp-cover-sheet", "qp-initial-letter", "qp-caf", "qp-voi"] } },
    });
    await prisma.checklistTask.updateMany({
      where: { id: { in: openingRequired.map((t) => t.id) } },
      data: { status: "COMPLETED", completedAt: new Date(), completedById: admin.id },
    });
    // qp-diary-dates is also required and also assigned to MATTER_OPENING.
    const diaryDates = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-diary-dates" } });
    await prisma.checklistTask.update({ where: { id: diaryDates.id }, data: { status: "COMPLETED", completedAt: new Date(), completedById: admin.id } });

    asAdmin();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "CONTRACT_REVIEW" }));
    expect(result).toEqual({ success: "Matter stage updated." });
  });

  it("never blocks a matter with no matterType set — unrestricted, as before this feature", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT No Checklist No Gate", jurisdiction: "QLD", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asAdmin();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "SETTLEMENT" }));
    expect(result).toEqual({ success: "Matter stage updated." });
  });

  it("never blocks moving backward, even with incomplete required tasks ahead", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Backward Always Allowed", jurisdiction: "QLD", matterType: "PURCHASE", matterStage: "PRE_SETTLEMENT", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    await checklist.ensureChecklistForWorkItem(item.id);

    asAdmin();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "MATTER_OPENING" }));
    expect(result).toEqual({ success: "Matter stage updated." });
  });
});
