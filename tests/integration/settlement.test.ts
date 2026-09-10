/**
 * Settlement Calculation, exercised through the real server actions
 * against the real database: draft creation/seeding, saving, finalising
 * (including the checklist auto-complete and version-history behaviour),
 * reopening, resetting, and permissions.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertDatabaseReachable, cleanup, createUser } from "./helpers";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/settlement/money";
import type { SettlementState } from "@/lib/settlement/state";

const session: { user: { id: string; name: string; email: string; role: string } | null } = {
  user: null,
};

vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const settlement = await import("@/lib/actions/settlement");
const checklist = await import("@/lib/actions/checklist");

let vaOne: Awaited<ReturnType<typeof createUser>>;
let vaTwo: Awaited<ReturnType<typeof createUser>>;
let admin: Awaited<ReturnType<typeof createUser>>;
let trainer: Awaited<ReturnType<typeof createUser>>;

const asVaOne = () => (session.user = { id: vaOne.id, name: vaOne.name, email: vaOne.email, role: "VA" });
const asVaTwo = () => (session.user = { id: vaTwo.id, name: vaTwo.name, email: vaTwo.email, role: "VA" });
const asAdmin = () => (session.user = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" });
const asTrainer = () => (session.user = { id: trainer.id, name: trainer.name, email: trainer.email, role: "TRAINER" });

beforeAll(async () => {
  await assertDatabaseReachable();
  vaOne = await createUser("VA", "settlement-one");
  vaTwo = await createUser("VA", "settlement-two");
  admin = await createUser("ADMIN", "settlement");
  trainer = await createUser("TRAINER", "settlement");
});

afterAll(async () => {
  await cleanup();
});

// loadOrCreateSettlementDraft now re-checks matter access itself, so its use
// as a plain setup step needs a session. Default to admin (may load any
// matter's draft); tests that care about a specific role still call as*().
beforeEach(() => {
  session.user = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" };
});

function withReadyMatter(state: SettlementState, overrides: Partial<SettlementState["matter"]> = {}): SettlementState {
  return {
    ...state,
    matter: {
      ...state.matter,
      settlementDate: "2026-09-15",
      contractPriceCents: dollarsToCents(600000),
      ...overrides,
    },
  };
}

describe("loadOrCreateSettlementDraft", () => {
  it("creates version 1 as a draft, seeded from the matter, on first open", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT QLD Purchase Settlement", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });

    const { draft, history } = await settlement.loadOrCreateSettlementDraft(item.id);
    expect(draft.version).toBe(1);
    expect(draft.status).toBe("DRAFT");
    expect(draft.jurisdiction).toBe("QLD");
    expect((draft.state as { matter: { transactionType: string; propertyAddress: string } }).matter.transactionType).toBe("PURCHASE");
    expect((draft.state as { matter: { propertyAddress: string } }).matter.propertyAddress).toBe("ZZ-AUDIT QLD Purchase Settlement");
    expect(history).toHaveLength(1);
  });

  it("is idempotent — opening it again returns the same draft, not a new version", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Idempotent Draft", jurisdiction: "QLD", matterType: "SALE", status: "NOT_STARTED", priority: "NORMAL" },
    });
    const first = await settlement.loadOrCreateSettlementDraft(item.id);
    const second = await settlement.loadOrCreateSettlementDraft(item.id);
    expect(second.draft.id).toBe(first.draft.id);
    expect(second.history).toHaveLength(1);
  });

  it("refuses a VA opening another VA's matter — no draft is created", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Cross-VA Load", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asVaTwo();
    await expect(settlement.loadOrCreateSettlementDraft(item.id)).rejects.toThrow(/your own matter/i);
    const rows = await prisma.settlementCalculation.count({ where: { workItemId: item.id } });
    expect(rows).toBe(0);
  });

  it("refuses an unauthenticated caller", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Anon Load", jurisdiction: "QLD", matterType: "SALE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    session.user = null;
    await expect(settlement.loadOrCreateSettlementDraft(item.id)).rejects.toThrow();
    const rows = await prisma.settlementCalculation.count({ where: { workItemId: item.id } });
    expect(rows).toBe(0);
  });
});

describe("saveSettlementDraft", () => {
  it("lets a VA save their own matter's draft, snapshotting the settlement amount", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Save Draft", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    const state = withReadyMatter(draft.state as unknown as SettlementState);

    asVaOne();
    const result = await settlement.saveSettlementDraft(item.id, state);
    expect(result.success).toBe(true);

    const updated = await prisma.settlementCalculation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(updated.settlementAmountCents).toBe(dollarsToCents(600000));
    expect(updated.updatedById).toBe(vaOne.id);
  });

  it("refuses a VA saving another VA's matter", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Not Your Matter", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);

    asVaTwo();
    const result = await settlement.saveSettlementDraft(item.id, draft.state as unknown as SettlementState);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("your own matter");
  });

  it("lets Admin save any VA's draft", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Admin Saves", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);

    asAdmin();
    const result = await settlement.saveSettlementDraft(item.id, draft.state as unknown as SettlementState);
    expect(result.success).toBe(true);
  });
});

describe("finaliseSettlementCalculation", () => {
  it("refuses to finalise an incomplete calculation", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Cannot Finalise Incomplete", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);

    asVaOne();
    const result = await settlement.finaliseSettlementCalculation(item.id, draft.state as unknown as SettlementState);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("required fields");

    const untouched = await prisma.settlementCalculation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(untouched.status).toBe("DRAFT");
  });

  it("finalises a ready calculation, locks it, and opens the next version as a new draft", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Finalise Ready", jurisdiction: "QLD", matterType: "SALE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    const state = withReadyMatter(draft.state as unknown as SettlementState);

    asVaOne();
    const result = await settlement.finaliseSettlementCalculation(item.id, state);
    expect(result.success).toBe(true);

    const finalised = await prisma.settlementCalculation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(finalised.status).toBe("FINALISED");
    expect(finalised.finalisedById).toBe(vaOne.id);
    expect(finalised.finalisedAt).not.toBeNull();
    expect(finalised.settlementAmountCents).toBe(dollarsToCents(600000));

    const newDraft = await prisma.settlementCalculation.findFirst({ where: { workItemId: item.id, status: "DRAFT" } });
    expect(newDraft).not.toBeNull();
    expect(newDraft?.version).toBe(2);
  });

  it("never overwrites a finalised version — saving after finalising only touches the new draft", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT History Preserved", jurisdiction: "QLD", matterType: "SALE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    const state = withReadyMatter(draft.state as unknown as SettlementState);
    asVaOne();
    await settlement.finaliseSettlementCalculation(item.id, state);

    const newDraft = await prisma.settlementCalculation.findFirstOrThrow({ where: { workItemId: item.id, status: "DRAFT" } });
    const editedState = withReadyMatter(newDraft.state as unknown as SettlementState, { contractPriceCents: dollarsToCents(999999) });
    await settlement.saveSettlementDraft(item.id, editedState);

    const finalisedVersion1 = await prisma.settlementCalculation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(finalisedVersion1.settlementAmountCents).toBe(dollarsToCents(600000));
    expect(finalisedVersion1.status).toBe("FINALISED");
  });

  it("auto-completes the matching checklist task on finalise (QLD Sale -> qv-adjustment-sheet) and no unrelated task", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Checklist Auto Complete", jurisdiction: "QLD", matterType: "SALE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asVaOne();
    await checklist.ensureChecklistForWorkItem(item.id);

    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    const state = withReadyMatter(draft.state as unknown as SettlementState);
    await settlement.finaliseSettlementCalculation(item.id, state);

    const adjustmentSheetTask = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qv-adjustment-sheet" } });
    expect(adjustmentSheetTask.status).toBe("COMPLETED");

    // A representative unrelated task must still be untouched.
    const unrelatedTask = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qv-matter-details" } });
    expect(unrelatedTask.status).toBe("NOT_STARTED");
  });

  it("auto-completes the matching checklist task for QLD Purchase (qp-approve-adjustments), once its own dependencies are met", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT QLD Purchase Checklist Link", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asVaOne();
    await checklist.ensureChecklistForWorkItem(item.id);
    // qp-approve-adjustments itself depends on these two — complete them
    // first, same as a VA would need to before the checklist lets them
    // complete it directly.
    for (const taskKey of ["qp-receive-adjustments", "qp-verify-rates"]) {
      const dep = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey } });
      const fd = new FormData();
      fd.set("status", "COMPLETED");
      await checklist.updateChecklistTaskStatus(dep.id, null, fd);
    }

    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    const state = withReadyMatter(draft.state as unknown as SettlementState);
    await settlement.finaliseSettlementCalculation(item.id, state);

    const task = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-approve-adjustments" } });
    expect(task.status).toBe("COMPLETED");
  });

  it("finalising still succeeds even when the matching checklist task can't yet be completed (its own dependencies aren't met) — never bypasses the checklist's own rules", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Finalise Without Checklist Deps", jurisdiction: "QLD", matterType: "PURCHASE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asVaOne();
    await checklist.ensureChecklistForWorkItem(item.id);
    // Deliberately do NOT complete qp-receive-adjustments/qp-verify-rates first.

    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    const state = withReadyMatter(draft.state as unknown as SettlementState);
    const result = await settlement.finaliseSettlementCalculation(item.id, state);
    expect(result.success).toBe(true);

    const task = await prisma.checklistTask.findFirstOrThrow({ where: { workItemId: item.id, taskKey: "qp-approve-adjustments" } });
    expect(task.status).toBe("NOT_STARTED");
  });

  it("does nothing to the checklist when the matter has no matterType (no checklist to link to)", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT No Matter Type Finalise", jurisdiction: "QLD", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asVaOne();
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    const state = withReadyMatter(draft.state as unknown as SettlementState);
    const result = await settlement.finaliseSettlementCalculation(item.id, state);
    expect(result.success).toBe(true);

    const taskCount = await prisma.checklistTask.count({ where: { workItemId: item.id } });
    expect(taskCount).toBe(0);
  });
});

describe("reopenSettlementCalculation", () => {
  it("refuses a VA — reopening is Admin/Trainer only", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT VA Cannot Reopen", jurisdiction: "QLD", matterType: "SALE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asVaOne();
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    await settlement.finaliseSettlementCalculation(item.id, withReadyMatter(draft.state as unknown as SettlementState));

    await expect(settlement.reopenSettlementCalculation(draft.id)).rejects.toThrow("Unauthorized");
  });

  it("lets a Trainer reopen a finalised calculation as the new current draft", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Trainer Reopens", jurisdiction: "QLD", matterType: "SALE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asVaOne();
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);
    await settlement.finaliseSettlementCalculation(item.id, withReadyMatter(draft.state as unknown as SettlementState));

    asTrainer();
    const result = await settlement.reopenSettlementCalculation(draft.id);
    expect(result.success).toBe(true);

    const drafts = await prisma.settlementCalculation.findMany({ where: { workItemId: item.id, status: "DRAFT" } });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].createdById).toBe(trainer.id);

    const stillFinalised = await prisma.settlementCalculation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(stillFinalised.status).toBe("FINALISED");
  });

  it("refuses to reopen a calculation that is still a draft", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Cannot Reopen Draft", jurisdiction: "QLD", matterType: "SALE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    const { draft } = await settlement.loadOrCreateSettlementDraft(item.id);

    asAdmin();
    const result = await settlement.reopenSettlementCalculation(draft.id);
    expect(result.success).toBe(false);
  });
});

describe("resetSettlementDraft", () => {
  it("resets the current draft back to a blank calculation without touching finalised history", async () => {
    const item = await prisma.workItem.create({
      data: { userId: vaOne.id, title: "ZZ-AUDIT Reset Draft", jurisdiction: "QLD", matterType: "SALE", status: "IN_PROGRESS", priority: "NORMAL" },
    });
    asVaOne();
    const { draft: v1 } = await settlement.loadOrCreateSettlementDraft(item.id);
    await settlement.finaliseSettlementCalculation(item.id, withReadyMatter(v1.state as unknown as SettlementState));

    const v2 = await prisma.settlementCalculation.findFirstOrThrow({ where: { workItemId: item.id, status: "DRAFT" } });
    await settlement.saveSettlementDraft(item.id, withReadyMatter(v2.state as unknown as SettlementState));

    const result = await settlement.resetSettlementDraft(item.id);
    expect(result.success).toBe(true);

    const resetDraft = await prisma.settlementCalculation.findUniqueOrThrow({ where: { id: v2.id } });
    expect(resetDraft.settlementAmountCents).toBeNull();
    expect((resetDraft.state as { matter: { contractPriceCents: number | null } }).matter.contractPriceCents).toBeNull();

    const untouchedHistory = await prisma.settlementCalculation.findUniqueOrThrow({ where: { id: v1.id } });
    expect(untouchedHistory.status).toBe("FINALISED");
    expect(untouchedHistory.settlementAmountCents).toBe(dollarsToCents(600000));
  });
});
