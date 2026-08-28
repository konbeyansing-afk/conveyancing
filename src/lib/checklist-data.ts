/**
 * Server-side checklist loading — the one place a matter's checklist rows
 * are fetched, ensured, merged with their template, and health-checked, so
 * every page/component that shows a checklist does it the same way.
 */

import { prisma } from "@/lib/prisma";
import { ensureChecklistForWorkItem } from "@/lib/actions/checklist";
import { type ChecklistTaskView, type MatterHealthIssue, mergeChecklistTasks, validateChecklist } from "@/lib/checklist";
import type { ChecklistTaskRow } from "@/lib/checklist";
import type { Jurisdiction, MatterStage, MatterType } from "@prisma/client";

export type MatterChecklist = {
  tasks: ChecklistTaskView[];
  issues: MatterHealthIssue[];
};

export async function loadChecklist(
  workItemId: string,
  jurisdiction: Jurisdiction,
  matterType: MatterType | null,
  matterStage: MatterStage,
): Promise<MatterChecklist> {
  await ensureChecklistForWorkItem(workItemId);

  const rows = await prisma.checklistTask.findMany({
    where: { workItemId },
    include: {
      completedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

  const rowViews: ChecklistTaskRow[] = rows.map((r) => ({
    id: r.id,
    taskKey: r.taskKey,
    status: r.status,
    notes: r.notes,
    blockedReason: r.blockedReason,
    dueDate: r.dueDate,
    completedAt: r.completedAt,
    completedById: r.completedById,
    completedByName: r.completedBy?.name ?? null,
    assignedToId: r.assignedToId,
    assignedToName: r.assignedTo?.name ?? null,
    updatedAt: r.updatedAt,
  }));

  const tasks = mergeChecklistTasks(jurisdiction, matterType, rowViews);
  const issues = validateChecklist(jurisdiction, matterType, matterStage, rowViews);

  return { tasks, issues };
}
