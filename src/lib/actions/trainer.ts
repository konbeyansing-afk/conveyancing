"use server";

/**
 * Trainer-side actions, and the admin-side action that decides which trainees a
 * trainer supervises.
 *
 * The permission boundary this file enforces: a trainer may observe and sign
 * off the trainees assigned to them. They cannot create or edit content, cannot
 * manage accounts, and cannot reach a trainee who is not theirs. Every action
 * re-checks the assignment server-side rather than trusting the page that
 * rendered the button.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { canTrainerActOnTrainee } from "@/lib/trainer-scope";

export type TrainerActionState = { error?: string; success?: string } | null;

/* ------------------------------------------------------------------ */
/* Assignment — admin only                                             */
/* ------------------------------------------------------------------ */

export async function assignTraineeToTrainer(
  _prevState: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  await requireRole("ADMIN");

  const trainerId = (formData.get("trainerId") as string)?.trim();
  const traineeId = (formData.get("traineeId") as string)?.trim();
  if (!trainerId || !traineeId) return { error: "Pick a trainer and a trainee." };

  const [trainer, trainee] = await Promise.all([
    prisma.user.findUnique({ where: { id: trainerId }, select: { role: true, name: true } }),
    prisma.user.findUnique({ where: { id: traineeId }, select: { role: true, name: true } }),
  ]);

  if (trainer?.role !== "TRAINER") return { error: "That user is not a trainer." };
  if (trainee?.role !== "TRAINEE") return { error: "That user is not a trainee." };

  await prisma.trainerAssignment.upsert({
    where: { trainerId_traineeId: { trainerId, traineeId } },
    update: {},
    create: { trainerId, traineeId },
  });

  revalidatePath("/admin/trainees");
  return { success: `${trainee.name} is now supervised by ${trainer.name}.` };
}

export async function unassignTraineeFromTrainer(
  _prevState: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  await requireRole("ADMIN");

  const trainerId = (formData.get("trainerId") as string)?.trim();
  const traineeId = (formData.get("traineeId") as string)?.trim();
  if (!trainerId || !traineeId) return { error: "Pick a trainer and a trainee." };

  await prisma.trainerAssignment.deleteMany({ where: { trainerId, traineeId } });

  revalidatePath("/admin/trainees");
  return { success: "Assignment removed." };
}

/* ------------------------------------------------------------------ */
/* Notes — trainers and admins, scoped to their own trainees           */
/* ------------------------------------------------------------------ */

export async function addTraineeNote(
  traineeId: string,
  _prevState: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  const actor = await requireRole("ADMIN", "TRAINER");

  if (!(await canTrainerActOnTrainee(actor, traineeId))) {
    return { error: "That trainee is not assigned to you." };
  }

  const body = (formData.get("body") as string)?.trim();
  if (!body) return { error: "Write something before saving." };
  if (body.length > 5000) return { error: "That note is too long." };

  await prisma.traineeNote.create({ data: { traineeId, authorId: actor.id, body } });

  revalidatePath(`/trainer/trainees/${traineeId}`);
  revalidatePath(`/admin/trainees`);
  return { success: "Note saved." };
}

export async function deleteTraineeNote(
  noteId: string,
  _prevState: TrainerActionState,
  _formData: FormData,
): Promise<TrainerActionState> {
  const actor = await requireRole("ADMIN", "TRAINER");

  const note = await prisma.traineeNote.findUnique({
    where: { id: noteId },
    select: { authorId: true, traineeId: true },
  });
  if (!note) return { error: "That note no longer exists." };

  // A trainer can only remove their own note; an admin can remove any.
  if (actor.role !== "ADMIN" && note.authorId !== actor.id) {
    return { error: "You can only delete your own notes." };
  }
  if (!(await canTrainerActOnTrainee(actor, note.traineeId))) {
    return { error: "That trainee is not assigned to you." };
  }

  await prisma.traineeNote.delete({ where: { id: noteId } });

  revalidatePath(`/trainer/trainees/${note.traineeId}`);
  return { success: "Note deleted." };
}

/* ------------------------------------------------------------------ */
/* Stage sign-off — the trainer's main gate-keeping power              */
/* ------------------------------------------------------------------ */

export async function approveStage(
  traineeId: string,
  stageId: string,
  _prevState: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  const actor = await requireRole("ADMIN", "TRAINER");

  if (!(await canTrainerActOnTrainee(actor, traineeId))) {
    return { error: "That trainee is not assigned to you." };
  }

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { id: true, title: true },
  });
  if (!stage) return { error: "That stage no longer exists." };

  const notes = (formData.get("notes") as string)?.trim() || null;

  await prisma.stageApproval.upsert({
    where: { stageId_userId: { stageId, userId: traineeId } },
    update: { approvedById: actor.id, notes, approvedAt: new Date() },
    create: { stageId, userId: traineeId, approvedById: actor.id, notes },
  });

  // Sign-off may have been the last thing the stage was waiting for.
  const { syncCompletionForStage } = await import("@/lib/completion");
  const { maybeCreateCertificate } = await import("@/lib/certificates");
  const sync = await syncCompletionForStage(stageId, traineeId);
  if (sync.programCompleted) await maybeCreateCertificate(traineeId, sync.programCompleted.id);

  revalidatePath(`/trainer/trainees/${traineeId}`);
  return { success: `Signed off "${stage.title}".` };
}

export async function withdrawStageApproval(
  traineeId: string,
  stageId: string,
  _prevState: TrainerActionState,
  _formData: FormData,
): Promise<TrainerActionState> {
  const actor = await requireRole("ADMIN", "TRAINER");

  if (!(await canTrainerActOnTrainee(actor, traineeId))) {
    return { error: "That trainee is not assigned to you." };
  }

  await prisma.stageApproval.deleteMany({ where: { stageId, userId: traineeId } });

  const { syncCompletionForStage } = await import("@/lib/completion");
  await syncCompletionForStage(stageId, traineeId);

  revalidatePath(`/trainer/trainees/${traineeId}`);
  return { success: "Sign-off withdrawn." };
}
