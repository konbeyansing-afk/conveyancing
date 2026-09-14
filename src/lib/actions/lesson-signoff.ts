"use server";

/**
 * Lesson Sign-Off — a trainee's self-attestation on a lesson that requires
 * one (Lesson.requiresSignOff), plus a Trainer/Admin's independent review.
 * One row per (lesson, trainee); the two halves are written by different
 * actors through the two actions below, never through the same one — a
 * trainee can never set the trainer fields, and a trainer/admin submitting
 * their half never touches the trainee's own fields.
 *
 * The trainer's review is oversight recorded after the fact: it does not
 * gate or un-complete the trainee's own lesson completion (see
 * src/lib/actions/progress.ts's markLessonComplete, which only ever checks
 * traineeSignedAt).
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { canTrainerActOnTrainee } from "@/lib/trainer-scope";
import type { SignOffResult } from "@prisma/client";

export type SignOffActionState = { error?: string; success?: string } | null;

export async function submitTraineeSignOff(
  lessonId: string,
  _prevState: SignOffActionState,
  formData: FormData,
): Promise<SignOffActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "You need to be signed in." };

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { requiresSignOff: true } });
  if (!lesson?.requiresSignOff) return { error: "This lesson does not require a sign-off." };

  const traineeName = (formData.get("traineeName") as string)?.trim();
  if (!traineeName) return { error: "Type your name to sign off on this lesson." };
  if (traineeName.length > 200) return { error: "That name is too long." };

  await prisma.lessonSignOff.upsert({
    where: { lessonId_userId: { lessonId, userId } },
    update: { traineeName, traineeSignedAt: new Date() },
    create: { lessonId, userId, traineeName, traineeSignedAt: new Date() },
  });

  // No revalidatePath here — like markLessonComplete, this is consumed by
  // InteractiveLessonViewer's own client-side state, not a page re-render.
  return { success: "Signed." };
}

export async function submitTrainerSignOff(
  lessonId: string,
  traineeId: string,
  _prevState: SignOffActionState,
  formData: FormData,
): Promise<SignOffActionState> {
  const actor = await requireRole("ADMIN", "TRAINER");

  if (!(await canTrainerActOnTrainee(actor, traineeId))) {
    return { error: "That trainee is not assigned to you." };
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { requiresSignOff: true } });
  if (!lesson?.requiresSignOff) return { error: "This lesson does not require a sign-off." };

  const trainerName = (formData.get("trainerName") as string)?.trim();
  if (!trainerName) return { error: "Type your name to record this review." };
  if (trainerName.length > 200) return { error: "That name is too long." };

  const result = formData.get("result") as SignOffResult;
  if (result !== "PASS" && result !== "REFER") return { error: "Choose Pass or Refer for Review." };

  const trainerNotes = (formData.get("trainerNotes") as string)?.trim() || null;
  if (result === "REFER" && !trainerNotes) {
    return { error: "Referring for review needs a reason." };
  }
  if (trainerNotes && trainerNotes.length > 2000) return { error: "That note is too long." };

  await prisma.lessonSignOff.upsert({
    where: { lessonId_userId: { lessonId, userId: traineeId } },
    update: { trainerName, trainerResult: result, trainerById: actor.id, trainerNotes, trainerSignedAt: new Date() },
    create: {
      lessonId,
      userId: traineeId,
      trainerName,
      trainerResult: result,
      trainerById: actor.id,
      trainerNotes,
      trainerSignedAt: new Date(),
    },
  });

  revalidatePath(`/trainer/trainees/${traineeId}`);
  return { success: result === "PASS" ? "Marked as Pass." : "Referred for review." };
}
