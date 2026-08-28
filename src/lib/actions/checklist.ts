"use server";

/**
 * Checklist server actions. Same permission shape as Work Status/Matter
 * Stage: a VA fully owns their own matter's checklist, Admin and any
 * Trainer can also update any VA's (oversight), and ownership is always
 * re-checked server-side — see requireChecklistAccess.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { checklistTemplate } from "@/lib/checklist-templates";
import { CHECKLIST_STATUS_VALUES, type ChecklistTaskRow, dependencyBlockers, mergeChecklistTasks } from "@/lib/checklist";
import type { ChecklistTaskStatus, WorkPriority } from "@prisma/client";

export type ChecklistActionState =
  | { error: string; success?: undefined }
  | { success: string; error?: undefined }
  | null;

/**
 * Idempotent: creates any checklist rows the matter's own Jurisdiction+
 * MatterType template defines but this matter doesn't have yet. Safe (and
 * cheap — a no-op once the checklist exists) to call every time the
 * checklist is viewed, so there is no separate "generate checklist" step
 * a VA has to remember to trigger. A matter with no matterType set, or a
 * jurisdiction/matterType combination with no template yet (NSW, before
 * it shipped), simply gets no rows.
 */
export async function ensureChecklistForWorkItem(workItemId: string): Promise<void> {
  const item = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: { jurisdiction: true, matterType: true, deletedAt: true },
  });
  if (!item || item.deletedAt) return;

  const template = checklistTemplate(item.jurisdiction, item.matterType);
  if (template.length === 0) return;

  const existing = await prisma.checklistTask.findMany({ where: { workItemId }, select: { taskKey: true } });
  const existingKeys = new Set(existing.map((r) => r.taskKey));
  const missing = template.filter((t) => !existingKeys.has(t.key));
  if (missing.length === 0) return;

  await prisma.checklistTask.createMany({
    data: missing.map((t) => ({ workItemId, taskKey: t.key })),
    skipDuplicates: true,
  });
}

async function requireChecklistAccess(taskId: string) {
  const actor = await requireRole("ADMIN", "TRAINER", "VA");
  const task = await prisma.checklistTask.findUnique({
    where: { id: taskId },
    include: {
      workItem: {
        select: { id: true, userId: true, jurisdiction: true, matterType: true, matterStage: true, deletedAt: true },
      },
    },
  });
  if (!task || task.workItem.deletedAt) {
    return { ok: false as const, error: "That checklist task no longer exists." };
  }
  if (actor.role === "VA" && task.workItem.userId !== actor.id) {
    return { ok: false as const, error: "You can only update your own matter's checklist." };
  }
  return { ok: true as const, actor, task };
}

function revalidateChecklistPaths(vaUserId: string) {
  revalidatePath("/va");
  revalidatePath(`/admin/work-status/${vaUserId}`);
  revalidatePath("/admin/work-status");
}

/**
 * Moves one checklist task to a new status. A task cannot be marked
 * Completed while a task it depends on is not itself Completed/Not
 * Applicable (spec section 9) — checked here, server-side, against the
 * matter's actual current task records, not just whatever the dropdown
 * happened to offer.
 */
export async function updateChecklistTaskStatus(
  taskId: string,
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const access = await requireChecklistAccess(taskId);
  if (!access.ok) return { error: access.error };
  const { actor, task } = access;

  const newStatus = formData.get("status") as ChecklistTaskStatus;
  if (!CHECKLIST_STATUS_VALUES.includes(newStatus)) return { error: "Invalid status." };

  const blockedReason = ((formData.get("blockedReason") as string) ?? "").trim() || null;
  if (newStatus === "BLOCKED" && !blockedReason) return { error: "Blocked tasks need a reason." };

  if (newStatus === "COMPLETED") {
    const allRows: ChecklistTaskRow[] = await prisma.checklistTask.findMany({ where: { workItemId: task.workItem.id } });
    const views = mergeChecklistTasks(task.workItem.jurisdiction, task.workItem.matterType, allRows);
    const byKey = new Map(views.map((v) => [v.taskKey, v]));
    const thisView = byKey.get(task.taskKey);
    if (thisView) {
      const blockers = dependencyBlockers(thisView, byKey);
      if (blockers.length > 0) {
        return { error: `Complete required first: ${blockers.map((b) => b.title).join(", ")}.` };
      }
    }
  }

  const now = new Date();
  await prisma.checklistTask.update({
    where: { id: taskId },
    data: {
      status: newStatus,
      blockedReason: newStatus === "BLOCKED" ? blockedReason : null,
      completedAt: newStatus === "COMPLETED" ? now : null,
      completedById: newStatus === "COMPLETED" ? actor.id : null,
    },
  });

  revalidateChecklistPaths(task.workItem.userId);
  return { success: "Task updated." };
}

/** Notes, due date, and priority on one checklist task — everything short of its status. */
export async function updateChecklistTaskDetails(
  taskId: string,
  _prevState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const access = await requireChecklistAccess(taskId);
  if (!access.ok) return { error: access.error };
  const { task } = access;

  const notes = ((formData.get("notes") as string) ?? "").trim() || null;
  const dueDateRaw = (formData.get("dueDate") as string) ?? "";
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) return { error: "Invalid due date." };
  const priorityRaw = (formData.get("priority") as string) || "";
  const priority = (priorityRaw || null) as WorkPriority | null;

  await prisma.checklistTask.update({ where: { id: taskId }, data: { notes, dueDate, priority } });

  revalidateChecklistPaths(task.workItem.userId);
  return { success: "Task details saved." };
}
