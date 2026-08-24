import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * What a trainer is allowed to see and act on.
 *
 * The boundary is deliberately narrow. A trainer supervises the trainees
 * assigned to them: they can watch progress, review assessments, sign off
 * stages and issue certificates for those people, and nothing else. Authoring
 * content and managing accounts stay with admins.
 *
 * An admin is not scoped — they see everyone — so every helper here takes the
 * acting user and short-circuits for ADMIN rather than making callers remember
 * to special-case it.
 */

export type Actor = { id: string; role: Role };

/** Trainee ids a trainer supervises. Admins are unscoped and get null. */
export async function scopedTraineeIds(actor: Actor): Promise<string[] | null> {
  if (actor.role === "ADMIN") return null;
  if (actor.role !== "TRAINER") return [];

  const assignments = await prisma.trainerAssignment.findMany({
    where: { trainerId: actor.id },
    select: { traineeId: true },
  });
  return assignments.map((a) => a.traineeId);
}

/**
 * A Prisma `where` fragment restricting a User query to the actor's trainees.
 * Admins get every trainee; a trainer gets only their own.
 */
export async function traineeScopeFilter(actor: Actor) {
  const ids = await scopedTraineeIds(actor);
  if (ids === null) return { role: "TRAINEE" as const };
  return { role: "TRAINEE" as const, id: { in: ids } };
}

/** Whether the actor may act on this particular trainee. */
export async function canTrainerActOnTrainee(actor: Actor, traineeId: string): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "TRAINER") return false;

  const assignment = await prisma.trainerAssignment.findUnique({
    where: { trainerId_traineeId: { trainerId: actor.id, traineeId } },
    select: { id: true },
  });
  return !!assignment;
}

/**
 * Loads a trainee the actor is allowed to see, or null.
 *
 * Returning null rather than throwing lets pages render a 404, which does not
 * tell a trainer whether an id they guessed belongs to a real person.
 */
export async function findScopedTrainee(actor: Actor, traineeId: string) {
  if (!(await canTrainerActOnTrainee(actor, traineeId))) return null;
  return prisma.user.findFirst({
    where: { id: traineeId, role: "TRAINEE" },
    select: { id: true, name: true, email: true, createdAt: true },
  });
}
