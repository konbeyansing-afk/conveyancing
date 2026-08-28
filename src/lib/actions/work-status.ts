"use server";

/**
 * Work Status server actions.
 *
 * Permission boundary: a VA fully owns their own work — create, edit, change
 * status, add notes, the matter's identity fields (Jurisdiction, Matter
 * Type), and its Matter Stage — and can never touch another VA's. Admin and
 * any Trainer can also move a matter's stage on any VA's work, as
 * oversight — see updateMatterStage. An Admin can additionally observe
 * everything, add Admin Notes, and soft-delete a work item (audited), but
 * cannot edit a VA's status or identity fields directly. Every action
 * re-checks ownership server-side; the UI hiding a button is never the only
 * protection. The authenticated actor's id is always used for
 * userId/authorship — never a client-supplied one.
 *
 * A VA may have several matters open (IN_PROGRESS) at the same time — there
 * is no one-active-task limit here. Each matter is independent: starting or
 * updating one never touches another.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import {
  WORK_PRIORITY_VALUES,
  WORK_STATUS_LABELS,
  WORK_STATUS_VALUES,
  isValidStatusTransition,
  needsBlockedReason,
} from "@/lib/work-status";
import {
  DEFAULT_MATTER_STAGE,
  JURISDICTION_VALUES,
  MATTER_STAGE_LABELS,
  MATTER_TYPE_VALUES,
  isStageValidForJurisdiction,
  isValidMatterStage,
} from "@/lib/matter-stage";
import { checklistTemplate } from "@/lib/checklist-templates";
import { mergeChecklistTasks, stageGateResult } from "@/lib/checklist";
import type { Jurisdiction, MatterStage, MatterType, WorkPriority, WorkStatus } from "@prisma/client";

export type WorkActionState =
  | { error: string; success?: undefined }
  | { success: string; error?: undefined }
  | null;

function parseCommonFields(formData: FormData) {
  const matterTypeRaw = (formData.get("matterType") as string) ?? "";
  return {
    title: ((formData.get("title") as string) ?? "").trim(),
    matterReference: ((formData.get("matterReference") as string) ?? "").trim() || null,
    clientReference: ((formData.get("clientReference") as string) ?? "").trim() || null,
    jurisdiction: (formData.get("jurisdiction") as string) as Jurisdiction,
    matterType: (matterTypeRaw || null) as MatterType | null,
    status: formData.get("status") as WorkStatus,
    priority: ((formData.get("priority") as WorkPriority) || "NORMAL") as WorkPriority,
    notes: ((formData.get("notes") as string) ?? "").trim() || null,
    blockedReason: ((formData.get("blockedReason") as string) ?? "").trim() || null,
    blockedNeeds: ((formData.get("blockedNeeds") as string) ?? "").trim() || null,
    estimatedCompletion: (() => {
      const raw = formData.get("estimatedCompletion") as string;
      return raw ? new Date(raw) : null;
    })(),
  };
}

function validateCommonFields(fields: ReturnType<typeof parseCommonFields>): string | null {
  if (!fields.title) return "Describe what you're working on.";
  if (fields.title.length > 300) return "That description is too long.";
  if (!JURISDICTION_VALUES.includes(fields.jurisdiction)) return "Invalid jurisdiction.";
  if (fields.matterType && !MATTER_TYPE_VALUES.includes(fields.matterType)) return "Invalid matter type.";
  if (!WORK_STATUS_VALUES.includes(fields.status)) return "Invalid status.";
  if (!WORK_PRIORITY_VALUES.includes(fields.priority)) return "Invalid priority.";
  if (needsBlockedReason(fields.status) && !fields.blockedReason) {
    return "Blocked work needs a reason.";
  }
  if (fields.estimatedCompletion && Number.isNaN(fields.estimatedCompletion.getTime())) {
    return "Invalid estimated completion date.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* VA — create, edit, notes                                            */
/* ------------------------------------------------------------------ */

export async function createWorkItem(
  _prevState: WorkActionState,
  formData: FormData,
): Promise<WorkActionState> {
  const actor = await requireRole("VA");

  const fields = parseCommonFields(formData);
  const validationError = validateCommonFields(fields);
  if (validationError) return { error: validationError };

  const now = new Date();
  const item = await prisma.workItem.create({
    data: {
      userId: actor.id,
      title: fields.title,
      matterReference: fields.matterReference,
      clientReference: fields.clientReference,
      jurisdiction: fields.jurisdiction,
      matterType: fields.matterType,
      status: fields.status,
      priority: fields.priority,
      notes: fields.notes,
      blockedReason: fields.status === "BLOCKED" ? fields.blockedReason : null,
      blockedNeeds: fields.status === "BLOCKED" ? fields.blockedNeeds : null,
      estimatedCompletion: fields.estimatedCompletion,
      startedAt: fields.status === "NOT_STARTED" ? null : now,
      completedAt: fields.status === "COMPLETED" ? now : null,
    },
  });

  await prisma.workActivity.create({
    data: {
      workItemId: item.id,
      userId: actor.id,
      previousStatus: null,
      newStatus: fields.status,
      note: fields.notes,
    },
  });

  revalidatePath("/va");
  revalidatePath("/admin/work-status");
  return { success: "Work status saved." };
}

export async function updateWorkItem(
  workItemId: string,
  _prevState: WorkActionState,
  formData: FormData,
): Promise<WorkActionState> {
  const actor = await requireRole("VA");

  const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
  if (!item || item.deletedAt) return { error: "That work item no longer exists." };
  if (item.userId !== actor.id) return { error: "You can only edit your own work." };

  const fields = parseCommonFields(formData);
  const validationError = validateCommonFields(fields);
  if (validationError) return { error: validationError };

  if (!isValidStatusTransition(item.status, fields.status)) {
    return {
      error: `Cannot change status from ${WORK_STATUS_LABELS[item.status]} to ${WORK_STATUS_LABELS[fields.status]}.`,
    };
  }

  const statusChanged = fields.status !== item.status;

  // Jurisdiction determines which matter-stage workflow applies (spec: "A
  // NSW matter should not accidentally receive a QLD-only workflow
  // stage"). Changing jurisdiction never leaves an invalid combination: if
  // the current stage does not belong to the new jurisdiction's workflow,
  // fall back to the universal starting stage and log why, the same way
  // any other stage change is logged.
  const jurisdictionChanged = fields.jurisdiction !== item.jurisdiction;
  const stageStillValid = isStageValidForJurisdiction(fields.jurisdiction, item.matterStage);
  const nextMatterStage: MatterStage = jurisdictionChanged && !stageStillValid ? DEFAULT_MATTER_STAGE : item.matterStage;
  const matterStageResetByJurisdiction = nextMatterStage !== item.matterStage;

  const now = new Date();
  await prisma.workItem.update({
    where: { id: workItemId },
    data: {
      title: fields.title,
      matterReference: fields.matterReference,
      clientReference: fields.clientReference,
      jurisdiction: fields.jurisdiction,
      matterType: fields.matterType,
      matterStage: nextMatterStage,
      status: fields.status,
      priority: fields.priority,
      notes: fields.notes,
      blockedReason: fields.status === "BLOCKED" ? fields.blockedReason : null,
      blockedNeeds: fields.status === "BLOCKED" ? fields.blockedNeeds : null,
      estimatedCompletion: fields.estimatedCompletion,
      startedAt: fields.status === "NOT_STARTED" ? null : (item.startedAt ?? now),
      completedAt:
        fields.status === "COMPLETED" ? (item.status === "COMPLETED" ? item.completedAt : now) : null,
    },
  });

  if (matterStageResetByJurisdiction) {
    await prisma.workActivity.create({
      data: {
        workItemId,
        userId: actor.id,
        previousStatus: item.status,
        newStatus: item.status,
        previousMatterStage: item.matterStage,
        newMatterStage: nextMatterStage,
        note: `Stage reset to ${MATTER_STAGE_LABELS[nextMatterStage]} — jurisdiction changed and the previous stage no longer applied.`,
      },
    });
  }

  if (statusChanged || fields.notes !== item.notes) {
    await prisma.workActivity.create({
      data: {
        workItemId,
        userId: actor.id,
        previousStatus: item.status,
        newStatus: fields.status,
        note: fields.notes,
      },
    });
  }

  revalidatePath("/va");
  revalidatePath("/admin/work-status");
  revalidatePath(`/admin/work-status/${actor.id}`);
  return { success: "Work status updated." };
}

/**
 * The quick-action status changes (Mark Completed / Mark Pending / Mark
 * Blocked / Resolve Blocker / Reopen) all funnel through here — they are all
 * "change this item's status, log it" with an optional note.
 */
export async function setWorkItemStatus(
  workItemId: string,
  newStatus: WorkStatus,
  _prevState: WorkActionState,
  formData: FormData,
): Promise<WorkActionState> {
  const actor = await requireRole("VA");

  const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
  if (!item || item.deletedAt) return { error: "That work item no longer exists." };
  if (item.userId !== actor.id) return { error: "You can only update your own work." };

  if (!WORK_STATUS_VALUES.includes(newStatus)) return { error: "Invalid status." };
  if (!isValidStatusTransition(item.status, newStatus)) {
    return {
      error: `Cannot change status from ${WORK_STATUS_LABELS[item.status]} to ${WORK_STATUS_LABELS[newStatus]}.`,
    };
  }

  const note = ((formData.get("note") as string) ?? "").trim() || null;
  const blockedReason = ((formData.get("blockedReason") as string) ?? "").trim() || null;
  const blockedNeeds = ((formData.get("blockedNeeds") as string) ?? "").trim() || null;

  if (needsBlockedReason(newStatus) && !blockedReason) {
    return { error: "Blocked work needs a reason." };
  }

  const now = new Date();
  await prisma.workItem.update({
    where: { id: workItemId },
    data: {
      status: newStatus,
      blockedReason: newStatus === "BLOCKED" ? blockedReason : null,
      blockedNeeds: newStatus === "BLOCKED" ? blockedNeeds : null,
      startedAt: newStatus === "NOT_STARTED" ? null : (item.startedAt ?? now),
      completedAt: newStatus === "COMPLETED" ? now : null,
    },
  });

  await prisma.workActivity.create({
    data: { workItemId, userId: actor.id, previousStatus: item.status, newStatus, note },
  });

  revalidatePath("/va");
  revalidatePath("/admin/work-status");
  revalidatePath(`/admin/work-status/${actor.id}`);
  return { success: "Status updated." };
}

export async function addWorkNote(
  workItemId: string,
  _prevState: WorkActionState,
  formData: FormData,
): Promise<WorkActionState> {
  const actor = await requireRole("VA");

  const item = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: { userId: true, status: true, deletedAt: true },
  });
  if (!item || item.deletedAt) return { error: "That work item no longer exists." };
  if (item.userId !== actor.id) return { error: "You can only add notes to your own work." };

  const note = (formData.get("note") as string)?.trim();
  if (!note) return { error: "Write something before saving." };
  if (note.length > 2000) return { error: "That note is too long." };

  await prisma.workActivity.create({
    data: { workItemId, userId: actor.id, previousStatus: item.status, newStatus: item.status, note },
  });

  revalidatePath("/va");
  revalidatePath("/admin/work-status");
  return { success: "Note added." };
}

/* ------------------------------------------------------------------ */
/* Matter Stage — the VA on their own matter, or Admin/Trainer on any   */
/* ------------------------------------------------------------------ */

/**
 * Moves a matter to a new stage in its conveyancing lifecycle. Kept as its
 * own action, separate from the VA's Work Status update above: Matter
 * Stage answers "where is the transaction?" while Work Status answers
 * "what is the VA's work doing right now?" — two different questions that
 * happen to now share who's allowed to answer them. A VA moves their own
 * matter along (they're the one actually doing the work); Admin and any
 * Trainer can move any VA's matter too, as oversight. Any Trainer is
 * treated as authorized today — there is no existing per-trainer
 * VA-assignment scope to check against (the TrainerAssignment model only
 * links trainers to Trainees, a different role), unlike the narrower
 * scoping trainers get elsewhere in the app.
 *
 * `newStage` travels in `formData` (name="newStage") rather than as a bound
 * argument: it is chosen dynamically from a single shared <select>, unlike
 * e.g. setWorkItemStatus's quick-action buttons, which are each bound to
 * one fixed target status at render time.
 */
export async function updateMatterStage(
  workItemId: string,
  _prevState: WorkActionState,
  formData: FormData,
): Promise<WorkActionState> {
  const actor = await requireRole("ADMIN", "TRAINER", "VA");

  const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
  if (!item || item.deletedAt) return { error: "That work item no longer exists." };
  if (actor.role === "VA" && item.userId !== actor.id) {
    return { error: "You can only move your own matter's stage." };
  }

  const newStage = formData.get("newStage") as MatterStage;
  if (!isValidMatterStage(newStage)) return { error: "Invalid matter stage." };

  if (!isStageValidForJurisdiction(item.jurisdiction, newStage)) {
    return { error: `${MATTER_STAGE_LABELS[newStage]} is not part of the ${item.jurisdiction} workflow.` };
  }

  if (newStage === item.matterStage) return { success: "Matter stage updated." };

  // Stage gating (spec section 8): a matter with a checklist template
  // cannot skip past a stage that still has incomplete required tasks.
  // Moving backward, or a matter with no template at all (no matterType
  // set, or a jurisdiction/matterType with no template yet), is
  // unrestricted — this only ever adds a check on top of the existing
  // free-form move, never removes the ability to correct a mistake.
  if (checklistTemplate(item.jurisdiction, item.matterType).length > 0) {
    const rows = await prisma.checklistTask.findMany({ where: { workItemId } });
    const views = mergeChecklistTasks(item.jurisdiction, item.matterType, rows);
    const gate = stageGateResult(item.jurisdiction, views, item.matterStage, newStage);
    if (!gate.allowed) {
      return {
        error: `Complete the required tasks in ${MATTER_STAGE_LABELS[gate.blockingStage]} before moving to ${MATTER_STAGE_LABELS[newStage]}.`,
      };
    }
  }

  const note = ((formData.get("note") as string) ?? "").trim() || null;

  await prisma.workItem.update({ where: { id: workItemId }, data: { matterStage: newStage } });

  await prisma.workActivity.create({
    data: {
      workItemId,
      userId: actor.id,
      previousStatus: item.status,
      newStatus: item.status,
      previousMatterStage: item.matterStage,
      newMatterStage: newStage,
      note,
    },
  });

  revalidatePath("/va");
  revalidatePath(`/admin/work-status/${item.userId}`);
  revalidatePath("/admin/work-status");
  return { success: "Matter stage updated." };
}

/* ------------------------------------------------------------------ */
/* Admin — notes and deletion, never a VA's status or fields            */
/* ------------------------------------------------------------------ */

export async function addAdminNote(
  workItemId: string,
  _prevState: WorkActionState,
  formData: FormData,
): Promise<WorkActionState> {
  const actor = await requireRole("ADMIN");

  const item = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: { userId: true, deletedAt: true },
  });
  if (!item || item.deletedAt) return { error: "That work item no longer exists." };

  const note = (formData.get("note") as string)?.trim();
  if (!note) return { error: "Write something before saving." };
  if (note.length > 2000) return { error: "That note is too long." };

  await prisma.workAdminNote.create({ data: { workItemId, adminUserId: actor.id, note } });

  revalidatePath(`/admin/work-status/${item.userId}`);
  revalidatePath("/admin/work-status");
  return { success: "Note added." };
}

/**
 * Soft delete only (spec section 32): the row and its activity/notes stay in
 * the database, flagged with who removed it and when, so the audit trail is
 * never lost.
 */
export async function softDeleteWorkItem(
  workItemId: string,
  _prevState: WorkActionState,
  _formData: FormData,
): Promise<WorkActionState> {
  const actor = await requireRole("ADMIN");

  const item = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: { userId: true, deletedAt: true },
  });
  if (!item || item.deletedAt) return { error: "That work item no longer exists." };

  await prisma.workItem.update({
    where: { id: workItemId },
    data: { deletedAt: new Date(), deletedById: actor.id },
  });

  revalidatePath(`/admin/work-status/${item.userId}`);
  revalidatePath("/admin/work-status");
  return { success: "Work item deleted." };
}
