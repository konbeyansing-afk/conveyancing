"use server";

/**
 * Settlement Calculation server actions — matter-linked persistence on top
 * of the untouched calculation engine (src/lib/settlement/*). Same
 * ownership shape as the rest of Work Status: a VA fully owns their own
 * matter's calculations (create, edit drafts, finalise), Admin and any
 * Trainer can also act on any VA's (oversight, including reopening a
 * finalised one — the one thing a VA cannot do), and ownership is always
 * re-checked server-side.
 *
 * These are called directly as plain async functions from client code
 * (not via useActionState/FormData) — the payload is a whole nested
 * SettlementState object, not a handful of form fields, so the FormData
 * convention used elsewhere in this codebase would just mean
 * JSON-stringifying it into a hidden field and parsing it back out. Server
 * Actions support being called directly like this; Next.js only requires
 * the FormData shape for actual `<form action={...}>` submissions.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { computeSettlementSnapshot } from "@/lib/settlement/snapshot";
import { seedSettlementStateFromMatter } from "@/lib/settlement/matter-seed";
import type { SettlementState } from "@/lib/settlement/state";
import { updateChecklistTaskStatus } from "@/lib/actions/checklist";
import type { Jurisdiction, MatterType } from "@prisma/client";

export type SettlementActionResult =
  | { success: true; calculationId: string; error?: undefined }
  | { success: false; error: string };

/** taskKey (see checklist-templates.ts) auto-completed when a matter's settlement calculation is finalised — the specific "prepare/approve the adjustment sheet" step for each jurisdiction+matterType, never an unrelated task. */
const FINALISE_CHECKLIST_TASK: Record<Jurisdiction, Partial<Record<MatterType, string>>> = {
  QLD: { PURCHASE: "qp-approve-adjustments", SALE: "qv-adjustment-sheet" },
  NSW: { PURCHASE: "np-adjustment-sheet", SALE: "nv-adjustment-sheet" },
};

async function requireMatterAccess(workItemId: string) {
  const actor = await requireRole("ADMIN", "TRAINER", "VA");
  const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
  if (!item || item.deletedAt) return { ok: false as const, error: "That matter no longer exists." };
  if (actor.role === "VA" && item.userId !== actor.id) {
    return { ok: false as const, error: "You can only work on your own matter's settlement calculations." };
  }
  return { ok: true as const, actor, item };
}

function revalidateSettlementPaths(workItemId: string, vaUserId: string) {
  revalidatePath(`/va/settlement-calculator/${workItemId}`);
  revalidatePath("/va");
  revalidatePath(`/admin/work-status/${vaUserId}`);
  revalidatePath("/admin/work-status");
}

/**
 * Loads the matter's current draft, creating version 1 (seeded from the
 * matter) if this is the first time its calculator has been opened. Also
 * returns every past version, most recent first, for the history list.
 * Called by the page (a Server Component) and by the actions below — but
 * because this module is "use server", it is also individually invokable,
 * so it re-checks matter access itself (a VA only their own; Admin/Trainer
 * any) rather than trusting the caller to have done so.
 */
export async function loadOrCreateSettlementDraft(workItemId: string) {
  const access = await requireMatterAccess(workItemId);
  if (!access.ok) throw new Error(access.error);
  const { item } = access;

  let draft = await prisma.settlementCalculation.findFirst({
    where: { workItemId, status: "DRAFT" },
    orderBy: { version: "desc" },
  });

  if (!draft) {
    const latestVersion = await prisma.settlementCalculation.aggregate({
      where: { workItemId },
      _max: { version: true },
    });
    const seeded = seedSettlementStateFromMatter(item);
    draft = await prisma.settlementCalculation.create({
      data: {
        workItemId,
        version: (latestVersion._max.version ?? 0) + 1,
        status: "DRAFT",
        jurisdiction: item.jurisdiction,
        state: seeded as object,
        createdById: item.userId,
      },
    });
  }

  const history = await prisma.settlementCalculation.findMany({
    where: { workItemId },
    orderBy: { version: "desc" },
    include: {
      createdBy: { select: { name: true } },
      finalisedBy: { select: { name: true } },
    },
  });

  return { draft, history };
}

export async function saveSettlementDraft(workItemId: string, state: SettlementState): Promise<SettlementActionResult> {
  const access = await requireMatterAccess(workItemId);
  if (!access.ok) return { success: false, error: access.error };
  const { actor, item } = access;

  const draft = await prisma.settlementCalculation.findFirst({ where: { workItemId, status: "DRAFT" } });
  if (!draft) return { success: false, error: "No draft calculation to save — reopen the calculator to start one." };

  const snapshot = computeSettlementSnapshot(state);
  await prisma.settlementCalculation.update({
    where: { id: draft.id },
    data: {
      state: state as object,
      settlementAmountCents: snapshot.settlementAmountCents,
      updatedById: actor.id,
    },
  });

  revalidateSettlementPaths(workItemId, item.userId);
  return { success: true, calculationId: draft.id };
}

/**
 * Finalises the matter's current draft (locked, immutable from here) and
 * opens the next version as a fresh draft seeded from it — spec section
 * 21's "do not silently overwrite historical calculations": the finalised
 * row is never touched again by Save Draft. Also auto-completes the one
 * checklist task that corresponds to "prepare/approve the settlement
 * adjustments" for this matter's jurisdiction+matterType, if that task
 * exists and isn't already done — never an unrelated task, and never if
 * the matter has no checklist (e.g. no matterType set).
 */
export async function finaliseSettlementCalculation(workItemId: string, state: SettlementState): Promise<SettlementActionResult> {
  const access = await requireMatterAccess(workItemId);
  if (!access.ok) return { success: false, error: access.error };
  const { actor, item } = access;

  const draft = await prisma.settlementCalculation.findFirst({ where: { workItemId, status: "DRAFT" } });
  if (!draft) return { success: false, error: "No draft calculation to finalise." };

  const snapshot = computeSettlementSnapshot(state);
  if (snapshot.status !== "READY") {
    return {
      success: false,
      error:
        snapshot.status === "INCOMPLETE"
          ? "Complete the required fields (settlement date, purchase price) before finalising."
          : "Resolve the highlighted errors before finalising.",
    };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.settlementCalculation.update({
      where: { id: draft.id },
      data: {
        state: state as object,
        status: "FINALISED",
        settlementAmountCents: snapshot.settlementAmountCents,
        updatedById: actor.id,
        finalisedAt: now,
        finalisedById: actor.id,
      },
    }),
    prisma.settlementCalculation.create({
      data: {
        workItemId,
        version: draft.version + 1,
        status: "DRAFT",
        jurisdiction: draft.jurisdiction,
        state: state as object,
        settlementAmountCents: snapshot.settlementAmountCents,
        createdById: actor.id,
      },
    }),
  ]);

  if (item.matterType) {
    const taskKey = FINALISE_CHECKLIST_TASK[item.jurisdiction]?.[item.matterType];
    if (taskKey) {
      const task = await prisma.checklistTask.findUnique({ where: { workItemId_taskKey: { workItemId, taskKey } } });
      if (task && task.status !== "COMPLETED") {
        const fd = new FormData();
        fd.set("status", "COMPLETED");
        await updateChecklistTaskStatus(task.id, null, fd);
      }
    }
  }

  revalidateSettlementPaths(workItemId, item.userId);
  return { success: true, calculationId: draft.id };
}

/** Admin/Trainer only — reopens a finalised calculation as the new current draft, e.g. to correct a mistake found after finalising. A VA cannot do this themselves. */
export async function reopenSettlementCalculation(calculationId: string): Promise<SettlementActionResult> {
  const actor = await requireRole("ADMIN", "TRAINER");
  const calc = await prisma.settlementCalculation.findUnique({ where: { id: calculationId } });
  if (!calc) return { success: false, error: "That calculation no longer exists." };
  if (calc.status !== "FINALISED") return { success: false, error: "Only a finalised calculation can be reopened." };

  const existingDraft = await prisma.settlementCalculation.findFirst({ where: { workItemId: calc.workItemId, status: "DRAFT" } });
  if (existingDraft) {
    await prisma.settlementCalculation.delete({ where: { id: existingDraft.id } });
  }

  const item = await prisma.workItem.findUniqueOrThrow({ where: { id: calc.workItemId } });
  const reopened = await prisma.settlementCalculation.create({
    data: {
      workItemId: calc.workItemId,
      version: existingDraft ? existingDraft.version : calc.version + 1,
      status: "DRAFT",
      jurisdiction: calc.jurisdiction,
      state: calc.state as object,
      settlementAmountCents: calc.settlementAmountCents,
      createdById: actor.id,
    },
  });

  revalidateSettlementPaths(calc.workItemId, item.userId);
  return { success: true, calculationId: reopened.id };
}

/** Resets the matter's current draft back to a blank calculation — the finalised history is untouched. */
export async function resetSettlementDraft(workItemId: string): Promise<SettlementActionResult> {
  const access = await requireMatterAccess(workItemId);
  if (!access.ok) return { success: false, error: access.error };
  const { item } = access;

  const draft = await prisma.settlementCalculation.findFirst({ where: { workItemId, status: "DRAFT" } });
  if (!draft) return { success: false, error: "No draft calculation to reset." };

  const seeded = seedSettlementStateFromMatter(item);
  await prisma.settlementCalculation.update({
    where: { id: draft.id },
    data: { state: seeded as object, settlementAmountCents: null },
  });

  revalidateSettlementPaths(workItemId, item.userId);
  return { success: true, calculationId: draft.id };
}
