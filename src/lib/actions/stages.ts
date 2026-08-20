"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { uniqueSlug } from "@/lib/slugify";

function programPath(programId: string) {
  return `/admin/programs/${programId}`;
}

export async function createStage(programId: string, formData: FormData) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const description = (formData.get("description") as string)?.trim() || null;
  const prerequisiteStageId = (formData.get("prerequisiteStageId") as string)?.trim() || null;
  const order = await prisma.stage.count({ where: { programId } });
  const slug = await uniqueSlug(
    title,
    async (candidate) => (await prisma.stage.count({ where: { programId, slug: candidate } })) > 0
  );

  await prisma.stage.create({
    data: { programId, title, slug, description, order, prerequisiteStageId },
  });

  revalidatePath(programPath(programId));
}

export async function updateStage(programId: string, stageId: string, formData: FormData) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const description = (formData.get("description") as string)?.trim() || null;
  const prerequisiteStageIdRaw = (formData.get("prerequisiteStageId") as string)?.trim() || null;
  const requireAllLessons = formData.get("requireAllLessons") === "on";
  const requireQuizPass = formData.get("requireQuizPass") === "on";
  const requireTrainerApproval = formData.get("requireTrainerApproval") === "on";
  const gatingQuizId = (formData.get("gatingQuizId") as string)?.trim() || null;
  const minQuizScoreRaw = (formData.get("minQuizScore") as string)?.trim();
  const minQuizScore = minQuizScoreRaw ? Number(minQuizScoreRaw) : null;
  const isPublished = formData.get("isPublished") === "on";

  // A stage can never be its own prerequisite.
  const prerequisiteStageId = prerequisiteStageIdRaw === stageId ? null : prerequisiteStageIdRaw;

  await prisma.stage.update({
    where: { id: stageId },
    data: {
      title,
      description,
      prerequisiteStageId,
      requireAllLessons,
      requireQuizPass,
      gatingQuizId: requireQuizPass ? gatingQuizId : null,
      minQuizScore: requireQuizPass ? minQuizScore : null,
      requireTrainerApproval,
      isPublished,
    },
  });

  revalidatePath(programPath(programId));
}

export async function toggleStagePublish(programId: string, stageId: string, isPublished: boolean) {
  await requireRole("ADMIN");
  await prisma.stage.update({ where: { id: stageId }, data: { isPublished } });
  revalidatePath(programPath(programId));
}

export async function deleteStage(programId: string, stageId: string, _formData: FormData) {
  await requireRole("ADMIN");
  await prisma.stage.delete({ where: { id: stageId } });
  revalidatePath(programPath(programId));
}

export async function moveStageOrder(programId: string, stageId: string, direction: "up" | "down") {
  await requireRole("ADMIN");

  const stages = await prisma.stage.findMany({
    where: { programId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const index = stages.findIndex((s) => s.id === stageId);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= stages.length) return;

  const current = stages[index];
  const swapWith = stages[swapIndex];

  await prisma.$transaction([
    prisma.stage.update({ where: { id: current.id }, data: { order: swapWith.order } }),
    prisma.stage.update({ where: { id: swapWith.id }, data: { order: current.order } }),
  ]);

  revalidatePath(programPath(programId));
}

export async function approveStageForTrainee(programId: string, stageId: string, formData: FormData) {
  const actor = await requireRole("ADMIN", "TRAINER");

  const userId = (formData.get("userId") as string)?.trim();
  if (!userId) return;
  const notes = (formData.get("notes") as string)?.trim() || null;

  await prisma.stageApproval.upsert({
    where: { stageId_userId: { stageId, userId } },
    update: { approvedById: actor.id, notes, approvedAt: new Date() },
    create: { stageId, userId, approvedById: actor.id, notes },
  });

  revalidatePath(programPath(programId));
}

export async function revokeStageApproval(programId: string, approvalId: string, _formData: FormData) {
  await requireRole("ADMIN", "TRAINER");
  await prisma.stageApproval.delete({ where: { id: approvalId } });
  revalidatePath(programPath(programId));
}
