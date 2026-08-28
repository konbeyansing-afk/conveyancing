/**
 * Work Status, exercised through the real server actions against the real
 * database: permissions (a VA owns only their own work; only an Admin can
 * add Admin Notes or delete), status transitions across multiple
 * concurrently open matters, and the WorkActivity audit trail.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertDatabaseReachable, cleanup, createUser } from "./helpers";
import { prisma } from "@/lib/prisma";

const session: { user: { id: string; name: string; email: string; role: string } | null } = {
  user: null,
};

vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const workStatus = await import("@/lib/actions/work-status");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

let vaOne: Awaited<ReturnType<typeof createUser>>;
let vaTwo: Awaited<ReturnType<typeof createUser>>;
let admin: Awaited<ReturnType<typeof createUser>>;
let trainer: Awaited<ReturnType<typeof createUser>>;
let trainee: Awaited<ReturnType<typeof createUser>>;

const asVaOne = () =>
  (session.user = { id: vaOne.id, name: vaOne.name, email: vaOne.email, role: "VA" });
const asVaTwo = () =>
  (session.user = { id: vaTwo.id, name: vaTwo.name, email: vaTwo.email, role: "VA" });
const asAdmin = () =>
  (session.user = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" });
const asTrainer = () =>
  (session.user = { id: trainer.id, name: trainer.name, email: trainer.email, role: "TRAINER" });
const asTrainee = () =>
  (session.user = { id: trainee.id, name: trainee.name, email: trainee.email, role: "TRAINEE" });
const asNobody = () => (session.user = null);

beforeAll(async () => {
  await assertDatabaseReachable();
  vaOne = await createUser("VA", "workstatus-one");
  vaTwo = await createUser("VA", "workstatus-two");
  admin = await createUser("ADMIN", "workstatus");
  trainer = await createUser("TRAINER", "workstatus");
  trainee = await createUser("TRAINEE", "workstatus");
});

afterAll(async () => {
  // WorkItem cascades to WorkActivity/WorkAdminNote (onDelete: Cascade on
  // the user relation), so removing the users this suite created is enough.
  await cleanup();
});

describe("createWorkItem — permissions", () => {
  it("refuses an unauthenticated caller", async () => {
    asNobody();
    await expect(
      workStatus.createWorkItem(
        null,
        form({ title: "x", jurisdiction: "QLD", status: "NOT_STARTED", priority: "NORMAL" }),
      ),
    ).rejects.toThrow("Unauthorized");
  });

  it("refuses a non-VA role", async () => {
    asTrainee();
    await expect(
      workStatus.createWorkItem(
        null,
        form({ title: "x", jurisdiction: "QLD", status: "NOT_STARTED", priority: "NORMAL" }),
      ),
    ).rejects.toThrow("Unauthorized");
  });

  it("requires a title", async () => {
    asVaOne();
    const result = await workStatus.createWorkItem(
      null,
      form({ title: "", jurisdiction: "QLD", status: "NOT_STARTED", priority: "NORMAL" }),
    );
    expect(result).toEqual({ error: "Describe what you're working on." });
  });

  it("requires a valid jurisdiction", async () => {
    asVaOne();
    const result = await workStatus.createWorkItem(
      null,
      form({ title: "ZZ-AUDIT No Jurisdiction", jurisdiction: "VIC", status: "NOT_STARTED", priority: "NORMAL" }),
    );
    expect(result).toEqual({ error: "Invalid jurisdiction." });
  });
});

describe("a VA can work multiple matters at once — no one-active-task limit", () => {
  it("lets a VA start a first active matter", async () => {
    asVaOne();
    const result = await workStatus.createWorkItem(
      null,
      form({ title: "ZZ-AUDIT Review Contract", jurisdiction: "QLD", status: "IN_PROGRESS", priority: "NORMAL" }),
    );
    expect(result).toEqual({ success: "Work status saved." });

    const item = await prisma.workItem.findFirst({
      where: { userId: vaOne.id, title: "ZZ-AUDIT Review Contract", deletedAt: null },
    });
    expect(item?.status).toBe("IN_PROGRESS");
    expect(item?.startedAt).not.toBeNull();
  });

  it("lets the same VA start a second active matter without touching the first", async () => {
    asVaOne();
    const result = await workStatus.createWorkItem(
      null,
      form({ title: "ZZ-AUDIT Second Matter", jurisdiction: "NSW", status: "IN_PROGRESS", priority: "NORMAL" }),
    );
    expect(result).toEqual({ success: "Work status saved." });

    const activeItems = await prisma.workItem.findMany({
      where: { userId: vaOne.id, status: "IN_PROGRESS", deletedAt: null },
    });
    expect(activeItems.length).toBeGreaterThanOrEqual(2);
    const first = activeItems.find((i) => i.title === "ZZ-AUDIT Review Contract");
    expect(first?.status).toBe("IN_PROGRESS");
  });

  it("updating one active matter's status never changes another's", async () => {
    asVaOne();
    const matterA = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Matter A", jurisdiction: "QLD", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    const matterB = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Matter B", jurisdiction: "QLD", status: "IN_PROGRESS", priority: "NORMAL" },
    });

    const result = await workStatus.setWorkItemStatus(matterA.id, "WAITING_PENDING", null, form({}));
    expect(result).toEqual({ success: "Status updated." });

    const untouchedB = await prisma.workItem.findUnique({ where: { id: matterB.id } });
    expect(untouchedB?.status).toBe("IN_PROGRESS");
  });
});

describe("status transitions and the activity audit trail", () => {
  it("rejects an invalid transition", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Not Started Task", status: "NOT_STARTED", priority: "LOW" },
    });

    const result = await workStatus.setWorkItemStatus(item.id, "COMPLETED", null, form({}));
    expect(result).toEqual({
      error: "Cannot change status from Not Started to Completed.",
    });
  });

  it("requires a reason to mark a task Blocked", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Blockable Task", status: "IN_PROGRESS", priority: "NORMAL" },
    });

    const result = await workStatus.setWorkItemStatus(item.id, "BLOCKED", null, form({}));
    expect(result).toEqual({ error: "Blocked work needs a reason." });
  });

  it("records previousStatus, newStatus, note, and the authenticated actor on every change", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Settlement Prep", status: "IN_PROGRESS", priority: "HIGH" },
    });

    await workStatus.setWorkItemStatus(
      item.id,
      "BLOCKED",
      null,
      form({ blockedReason: "Waiting for payout figure", blockedNeeds: "Updated mortgage payout figure" }),
    );

    const blocked = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(blocked?.status).toBe("BLOCKED");
    expect(blocked?.blockedReason).toBe("Waiting for payout figure");

    await workStatus.setWorkItemStatus(
      item.id,
      "IN_PROGRESS",
      null,
      form({ note: "Received updated payout." }),
    );

    const activity = await prisma.workActivity.findMany({
      where: { workItemId: item.id },
      orderBy: { createdAt: "asc" },
    });

    // The item itself was seeded directly (not through createWorkItem), so
    // only the two setWorkItemStatus calls above produced activity rows.
    expect(activity).toHaveLength(2);
    expect(activity[0].previousStatus).toBe("IN_PROGRESS");
    expect(activity[0].newStatus).toBe("BLOCKED");
    expect(activity[1].previousStatus).toBe("BLOCKED");
    expect(activity[1].newStatus).toBe("IN_PROGRESS");
    expect(activity[1].note).toBe("Received updated payout.");
    expect(activity.every((a) => a.userId === vaOne.id)).toBe(true);

    // Resolving the blocker clears the current blocked fields — the history
    // above is what makes it auditable, not the current row.
    const resolved = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(resolved?.blockedReason).toBeNull();
  });

  it("allows reopening a completed task and logs it", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: {
        userId: vaOne.id,
        title: "ZZ-AUDIT Council Search",
        status: "COMPLETED",
        priority: "NORMAL",
        completedAt: new Date(),
      },
    });

    const result = await workStatus.setWorkItemStatus(
      item.id,
      "IN_PROGRESS",
      null,
      form({ note: "Additional work required." }),
    );
    expect(result).toEqual({ success: "Status updated." });

    const reopened = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(reopened?.status).toBe("IN_PROGRESS");
    expect(reopened?.completedAt).toBeNull();
  });
});

describe("ownership — a VA cannot touch another VA's work", () => {
  it("refuses to update another VA's item", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Owned By One", status: "NOT_STARTED", priority: "NORMAL" },
    });

    asVaTwo();
    const result = await workStatus.updateWorkItem(
      item.id,
      null,
      form({ title: "Hijacked", status: "NOT_STARTED", priority: "NORMAL" }),
    );
    expect(result).toEqual({ error: "You can only edit your own work." });

    const untouched = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(untouched?.title).toBe("ZZ-AUDIT Owned By One");
  });

  it("refuses to change another VA's status or add a note to their work", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Owned By One Again", status: "IN_PROGRESS", priority: "NORMAL" },
    });

    asVaTwo();
    const statusResult = await workStatus.setWorkItemStatus(item.id, "COMPLETED", null, form({}));
    expect(statusResult).toEqual({ error: "You can only update your own work." });

    const noteResult = await workStatus.addWorkNote(item.id, null, form({ note: "Sneaky note" }));
    expect(noteResult).toEqual({ error: "You can only add notes to your own work." });
  });
});

describe("Admin notes and deletion — never a VA's status", () => {
  it("refuses a VA adding an Admin Note", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Needs ID", status: "NOT_STARTED", priority: "NORMAL" },
    });

    await expect(
      workStatus.addAdminNote(item.id, null, form({ note: "Follow up with client." })),
    ).rejects.toThrow("Unauthorized");
  });

  it("lets an Admin add an Admin Note, distinct from the VA's own notes", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Needs ID Two", status: "NOT_STARTED", priority: "NORMAL" },
    });

    asAdmin();
    const result = await workStatus.addAdminNote(
      item.id,
      null,
      form({ note: "Please follow up with the client for the missing ID." }),
    );
    expect(result).toEqual({ success: "Note added." });

    const notes = await prisma.workAdminNote.findMany({ where: { workItemId: item.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0].adminUserId).toBe(admin.id);
  });

  it("refuses a VA soft-deleting a work item", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Deletable", status: "NOT_STARTED", priority: "NORMAL" },
    });

    await expect(workStatus.softDeleteWorkItem(item.id, null, form({}))).rejects.toThrow("Unauthorized");
  });

  it("lets an Admin soft-delete a work item, recording who and when", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Deletable Two", status: "NOT_STARTED", priority: "NORMAL" },
    });

    asAdmin();
    const result = await workStatus.softDeleteWorkItem(item.id, null, form({}));
    expect(result).toEqual({ success: "Work item deleted." });

    const deleted = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(deleted).not.toBeNull(); // soft delete only — never gone
    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.deletedById).toBe(admin.id);
  });
});

describe("Jurisdiction — a QLD or NSW matter, persisted", () => {
  it("creates a QLD matter and it persists as QLD after a fresh read", async () => {
    asVaOne();
    await workStatus.createWorkItem(
      null,
      form({
        title: "ZZ-AUDIT QLD Purchase",
        jurisdiction: "QLD",
        matterType: "PURCHASE",
        status: "NOT_STARTED",
        priority: "NORMAL",
      }),
    );

    const item = await prisma.workItem.findFirst({ where: { userId: vaOne.id, title: "ZZ-AUDIT QLD Purchase" } });
    expect(item?.jurisdiction).toBe("QLD");
    expect(item?.matterType).toBe("PURCHASE");
    // Every matter starts here regardless of jurisdiction (spec: safe default).
    expect(item?.matterStage).toBe("MATTER_OPENING");

    // A second, independent read — "persists after refresh" is only really
    // proven by not trusting the row the create call itself returned.
    const reread = await prisma.workItem.findUnique({ where: { id: item!.id } });
    expect(reread?.jurisdiction).toBe("QLD");
  });

  it("creates an NSW matter and it persists as NSW after a fresh read", async () => {
    asVaOne();
    await workStatus.createWorkItem(
      null,
      form({
        title: "ZZ-AUDIT NSW Sale",
        jurisdiction: "NSW",
        matterType: "SALE",
        status: "NOT_STARTED",
        priority: "NORMAL",
      }),
    );

    const item = await prisma.workItem.findFirst({ where: { userId: vaOne.id, title: "ZZ-AUDIT NSW Sale" } });
    expect(item?.jurisdiction).toBe("NSW");
    expect(item?.matterType).toBe("SALE");

    const reread = await prisma.workItem.findUnique({ where: { id: item!.id } });
    expect(reread?.jurisdiction).toBe("NSW");
  });

  it("an existing matter created before this field existed still resolves to the safe default", async () => {
    // Simulates a pre-migration row: create bypassing the action's own
    // defaulting, relying purely on the column default the migration set.
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Legacy Row", status: "NOT_STARTED", priority: "NORMAL" },
    });
    expect(item.jurisdiction).toBe("QLD");
    expect(item.matterStage).toBe("MATTER_OPENING");
  });

  it("changing jurisdiction resets an incompatible stage and logs why", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: {
        userId: vaOne.id,
        title: "ZZ-AUDIT Jurisdiction Switch",
        jurisdiction: "QLD",
        matterStage: "CONTRACT_SIGNED", // QLD-only — invalid once switched to NSW
        status: "NOT_STARTED",
        priority: "NORMAL",
      },
    });

    const result = await workStatus.updateWorkItem(
      item.id,
      null,
      form({
        title: item.title,
        jurisdiction: "NSW",
        status: "NOT_STARTED",
        priority: "NORMAL",
      }),
    );
    expect(result).toEqual({ success: "Work status updated." });

    const updated = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(updated?.jurisdiction).toBe("NSW");
    expect(updated?.matterStage).toBe("MATTER_OPENING");

    const activity = await prisma.workActivity.findFirst({
      where: { workItemId: item.id, newMatterStage: { not: null } },
    });
    expect(activity?.previousMatterStage).toBe("CONTRACT_SIGNED");
    expect(activity?.newMatterStage).toBe("MATTER_OPENING");
  });

  it("keeps the stage when the new jurisdiction still supports it", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: {
        userId: vaOne.id,
        title: "ZZ-AUDIT Jurisdiction Switch Shared Stage",
        jurisdiction: "QLD",
        matterStage: "SEARCHES", // valid in both workflows
        status: "NOT_STARTED",
        priority: "NORMAL",
      },
    });

    await workStatus.updateWorkItem(
      item.id,
      null,
      form({ title: item.title, jurisdiction: "NSW", status: "NOT_STARTED", priority: "NORMAL" }),
    );

    const updated = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(updated?.matterStage).toBe("SEARCHES");
  });
});

describe("Matter Stage — moving a matter through its conveyancing lifecycle", () => {
  it("lets a VA move the stage on their own matter — they're the one doing the work", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT VA Own Stage", jurisdiction: "QLD", status: "IN_PROGRESS", priority: "NORMAL" },
    });

    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "SEARCHES" }));
    expect(result).toEqual({ success: "Matter stage updated." });

    const updated = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(updated?.matterStage).toBe("SEARCHES");

    const activity = await prisma.workActivity.findFirst({
      where: { workItemId: item.id, newMatterStage: "SEARCHES" },
    });
    expect(activity?.userId).toBe(vaOne.id);
  });

  it("refuses a VA changing another VA's matter stage", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT VA Cannot Stage Someone Else's", jurisdiction: "QLD", status: "NOT_STARTED", priority: "NORMAL" },
    });

    asVaTwo();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "SEARCHES" }));
    expect(result).toEqual({ error: "You can only move your own matter's stage." });

    const untouched = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(untouched?.matterStage).toBe("MATTER_OPENING");
  });

  it("lets an Admin move a matter to a valid stage for its jurisdiction", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Admin Stage", jurisdiction: "QLD", status: "IN_PROGRESS", priority: "NORMAL" },
    });

    asAdmin();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "SEARCHES", note: "Ordered searches." }));
    expect(result).toEqual({ success: "Matter stage updated." });

    const updated = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(updated?.matterStage).toBe("SEARCHES");

    const activity = await prisma.workActivity.findFirst({
      where: { workItemId: item.id, newMatterStage: "SEARCHES" },
    });
    expect(activity?.previousMatterStage).toBe("MATTER_OPENING");
    expect(activity?.note).toBe("Ordered searches.");
    expect(activity?.userId).toBe(admin.id);
    // A stage change alone does not touch Work Status.
    expect(activity?.previousStatus).toBe("IN_PROGRESS");
    expect(activity?.newStatus).toBe("IN_PROGRESS");
  });

  it("lets an authorized Trainer move a matter's stage too", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Trainer Stage", jurisdiction: "QLD", status: "NOT_STARTED", priority: "NORMAL" },
    });

    asTrainer();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "CONTRACT_REVIEW" }));
    expect(result).toEqual({ success: "Matter stage updated." });

    const updated = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(updated?.matterStage).toBe("CONTRACT_REVIEW");
  });

  it("refuses a QLD-only stage on an NSW matter", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT NSW Matter", jurisdiction: "NSW", status: "NOT_STARTED", priority: "NORMAL" },
    });

    asAdmin();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "CONTRACT_SIGNED" }));
    expect(result).toEqual({ error: "Contract Signed is not part of the NSW workflow." });

    const untouched = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(untouched?.matterStage).toBe("MATTER_OPENING");
  });

  it("refuses an NSW-only stage on a QLD matter", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT QLD Matter", jurisdiction: "QLD", status: "NOT_STARTED", priority: "NORMAL" },
    });

    asAdmin();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "CONTRACT_EXCHANGE" }));
    expect(result).toEqual({ error: "Contract Exchange is not part of the QLD workflow." });
  });

  it("rejects an invalid stage value outright", async () => {
    asVaOne();
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Bad Stage", jurisdiction: "QLD", status: "NOT_STARTED", priority: "NORMAL" },
    });

    asAdmin();
    const result = await workStatus.updateMatterStage(item.id, null, form({ newStage: "NOT_A_REAL_STAGE" }));
    expect(result).toEqual({ error: "Invalid matter stage." });
  });
});
