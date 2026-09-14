"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import type { CompletionRequirement, Difficulty, LessonType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { uniqueSlug } from "@/lib/slugify";

const LESSON_TYPES: LessonType[] = ["STANDARD", "VIDEO", "READING", "PRACTICAL", "QUIZ", "ASSESSMENT"];
const DIFFICULTIES: Difficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const COMPLETION_REQUIREMENTS: CompletionRequirement[] = ["VIEW_ALL", "PASS_QUIZ"];

function coursePath(programId: string, courseId: string) {
  return `/admin/programs/${programId}/courses/${courseId}`;
}

function lessonPath(programId: string, courseId: string, lessonId: string) {
  return `${coursePath(programId, courseId)}/lessons/${lessonId}`;
}

export async function createLesson(
  programId: string,
  courseId: string,
  moduleId: string,
  formData: FormData
): Promise<{ lessonId: string } | undefined> {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const order = await prisma.lesson.count({ where: { moduleId } });
  const slug = await uniqueSlug(
    title,
    async (candidate) =>
      (await prisma.lesson.count({ where: { moduleId, slug: candidate } })) > 0
  );

  const lesson = await prisma.lesson.create({
    data: { moduleId, title, slug, order },
    select: { id: true },
  });

  revalidatePath(coursePath(programId, courseId));
  return { lessonId: lesson.id };
}

export async function updateLesson(
  programId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  formData: FormData
) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const order = Number(formData.get("order")) || 0;

  await prisma.lesson.update({ where: { id: lessonId }, data: { title, order } });

  revalidatePath(coursePath(programId, courseId));
  revalidatePath(lessonPath(programId, courseId, lessonId));
}

export async function deleteLesson(
  programId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  _formData: FormData
) {
  await requireRole("ADMIN");
  await prisma.lesson.delete({ where: { id: lessonId } });
  revalidatePath(coursePath(programId, courseId));
  redirect(coursePath(programId, courseId));
}

export async function updateLessonContent(
  programId: string,
  courseId: string,
  lessonId: string,
  content: JSONContent
) {
  await requireRole("ADMIN");
  await prisma.lesson.update({ where: { id: lessonId }, data: { content } });
  revalidatePath(lessonPath(programId, courseId, lessonId));
}

export async function updateLessonTrainerNotes(
  programId: string,
  courseId: string,
  lessonId: string,
  content: JSONContent
) {
  await requireRole("ADMIN");
  await prisma.lesson.update({ where: { id: lessonId }, data: { trainerNotes: content } });
  revalidatePath(lessonPath(programId, courseId, lessonId));
}

export type UpdateLessonDetailsState = { error?: string; savedAt?: number } | null;

export async function updateLessonDetails(
  programId: string,
  courseId: string,
  lessonId: string,
  _prevState: UpdateLessonDetailsState,
  formData: FormData
): Promise<UpdateLessonDetailsState> {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Title is required." };

  const description = (formData.get("description") as string)?.trim() || null;
  const lessonTypeRaw = formData.get("lessonType") as string;
  const difficultyRaw = formData.get("difficulty") as string;
  const completionRaw = formData.get("completionRequirement") as string;
  const estimatedMinutesRaw = (formData.get("estimatedMinutes") as string)?.trim();
  const estimatedMinutes = estimatedMinutesRaw ? Number(estimatedMinutesRaw) : null;
  const requiresSignOff = formData.get("requiresSignOff") === "on";

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title,
      description,
      lessonType: LESSON_TYPES.includes(lessonTypeRaw as LessonType)
        ? (lessonTypeRaw as LessonType)
        : undefined,
      difficulty: DIFFICULTIES.includes(difficultyRaw as Difficulty)
        ? (difficultyRaw as Difficulty)
        : undefined,
      completionRequirement: COMPLETION_REQUIREMENTS.includes(
        completionRaw as CompletionRequirement
      )
        ? (completionRaw as CompletionRequirement)
        : undefined,
      estimatedMinutes:
        estimatedMinutes !== null && Number.isFinite(estimatedMinutes) && estimatedMinutes >= 0
          ? Math.round(estimatedMinutes)
          : null,
      requiresSignOff,
    },
  });

  revalidatePath(lessonPath(programId, courseId, lessonId));
  revalidatePath(coursePath(programId, courseId));
  return { savedAt: Date.now() };
}

export async function toggleLessonPublish(
  programId: string,
  courseId: string,
  lessonId: string,
  isPublished: boolean
) {
  await requireRole("ADMIN");
  await prisma.lesson.update({ where: { id: lessonId }, data: { isPublished } });
  revalidatePath(lessonPath(programId, courseId, lessonId));
  revalidatePath(coursePath(programId, courseId));
}

export async function moveLessonOrder(
  programId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  direction: "up" | "down"
) {
  await requireRole("ADMIN");

  const lessons = await prisma.lesson.findMany({
    where: { moduleId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= lessons.length) return;

  const current = lessons[index];
  const swapWith = lessons[swapIndex];

  await prisma.$transaction([
    prisma.lesson.update({ where: { id: current.id }, data: { order: swapWith.order } }),
    prisma.lesson.update({ where: { id: swapWith.id }, data: { order: current.order } }),
  ]);

  revalidatePath(coursePath(programId, courseId));
}

export async function addLessonAttachment(
  programId: string,
  courseId: string,
  lessonId: string,
  formData: FormData
) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  const url = (formData.get("url") as string)?.trim();
  const fileType = (formData.get("fileType") as string)?.trim();
  if (!title || !url || !fileType) return;

  await prisma.lessonAttachment.create({ data: { lessonId, title, url, fileType } });
  revalidatePath(lessonPath(programId, courseId, lessonId));
}

export async function removeLessonAttachment(
  programId: string,
  courseId: string,
  lessonId: string,
  attachmentId: string,
  _formData: FormData
) {
  await requireRole("ADMIN");
  await prisma.lessonAttachment.delete({ where: { id: attachmentId } });
  revalidatePath(lessonPath(programId, courseId, lessonId));
}
