/**
 * Lesson Sign-Off, exercised through the real server actions against the
 * real database: a trainee can only ever set their own half of the row; a
 * Trainer/Admin's review is independent and never gates or un-completes the
 * trainee's own lesson completion.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertDatabaseReachable,
  cleanup,
  createCourseWithLessons,
  createProgram,
  createStage,
  createUser,
  enrol,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const session: { user: { id: string; name: string; email: string; role: string } | null } = {
  user: null,
};

vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const signoff = await import("@/lib/actions/lesson-signoff");
const progress = await import("@/lib/actions/progress");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

let trainee: Awaited<ReturnType<typeof createUser>>;
let assignedTrainer: Awaited<ReturnType<typeof createUser>>;
let unassignedTrainer: Awaited<ReturnType<typeof createUser>>;
let admin: Awaited<ReturnType<typeof createUser>>;
let lessonId: string;

const asTrainee = () =>
  (session.user = { id: trainee.id, name: trainee.name, email: trainee.email, role: "TRAINEE" });
const asAssignedTrainer = () =>
  (session.user = { id: assignedTrainer.id, name: assignedTrainer.name, email: assignedTrainer.email, role: "TRAINER" });
const asUnassignedTrainer = () =>
  (session.user = { id: unassignedTrainer.id, name: unassignedTrainer.name, email: unassignedTrainer.email, role: "TRAINER" });
const asAdmin = () => (session.user = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" });
const asNobody = () => (session.user = null);

beforeAll(async () => {
  await assertDatabaseReachable();
  trainee = await createUser("TRAINEE", "signoff");
  assignedTrainer = await createUser("TRAINER", "signoff-assigned");
  unassignedTrainer = await createUser("TRAINER", "signoff-unassigned");
  admin = await createUser("ADMIN", "signoff");

  await prisma.trainerAssignment.create({
    data: { trainerId: assignedTrainer.id, traineeId: trainee.id },
  });

  const program = await createProgram();
  const stage = await createStage(program.id, { order: 0, title: "Sign-Off Stage" });
  const course = await createCourseWithLessons(program.id, stage.id, { title: "Sign-Off Course", lessonCount: 1 });
  lessonId = course.modules[0].lessons[0].id;
  await prisma.lesson.update({ where: { id: lessonId }, data: { requiresSignOff: true } });
  await enrol(trainee.id, course.id);
});

afterAll(async () => {
  await cleanup();
});

describe("submitTraineeSignOff", () => {
  it("refuses an unauthenticated caller", async () => {
    asNobody();
    const result = await signoff.submitTraineeSignOff(lessonId, null, form({ traineeName: "A. Trainee" }));
    expect(result).toEqual({ error: "You need to be signed in." });
  });

  it("requires a name", async () => {
    asTrainee();
    const result = await signoff.submitTraineeSignOff(lessonId, null, form({ traineeName: "" }));
    expect(result?.error).toBeTruthy();
  });

  it("lets the trainee sign their own name", async () => {
    asTrainee();
    const result = await signoff.submitTraineeSignOff(lessonId, null, form({ traineeName: "A. Trainee" }));
    expect(result).toEqual({ success: "Signed." });

    const row = await prisma.lessonSignOff.findUnique({ where: { lessonId_userId: { lessonId, userId: trainee.id } } });
    expect(row?.traineeName).toBe("A. Trainee");
    expect(row?.traineeSignedAt).not.toBeNull();
    expect(row?.trainerResult).toBeNull();
  });
});

describe("submitTrainerSignOff", () => {
  it("refuses a trainee", async () => {
    asTrainee();
    await expect(
      signoff.submitTrainerSignOff(lessonId, trainee.id, null, form({ trainerName: "x", result: "PASS" })),
    ).rejects.toThrow("Unauthorized");
  });

  it("refuses a trainer not assigned to this trainee", async () => {
    asUnassignedTrainer();
    const result = await signoff.submitTrainerSignOff(lessonId, trainee.id, null, form({ trainerName: "x", result: "PASS" }));
    expect(result).toEqual({ error: "That trainee is not assigned to you." });
  });

  it("requires a name", async () => {
    asAssignedTrainer();
    const result = await signoff.submitTrainerSignOff(lessonId, trainee.id, null, form({ trainerName: "", result: "PASS" }));
    expect(result?.error).toBeTruthy();
  });

  it("requires a reason when referring for review", async () => {
    asAssignedTrainer();
    const result = await signoff.submitTrainerSignOff(
      lessonId,
      trainee.id,
      null,
      form({ trainerName: "J. Trainer", result: "REFER" }),
    );
    expect(result?.error).toBeTruthy();
  });

  it("lets the assigned trainer refer for review, with a reason, without touching the trainee's own fields", async () => {
    asAssignedTrainer();
    const result = await signoff.submitTrainerSignOff(
      lessonId,
      trainee.id,
      null,
      form({ trainerName: "J. Trainer", result: "REFER", trainerNotes: "Needs to redo the exercise." }),
    );
    expect(result).toEqual({ success: "Referred for review." });

    const row = await prisma.lessonSignOff.findUnique({ where: { lessonId_userId: { lessonId, userId: trainee.id } } });
    expect(row?.trainerName).toBe("J. Trainer");
    expect(row?.trainerResult).toBe("REFER");
    expect(row?.trainerNotes).toBe("Needs to redo the exercise.");
    // Untouched from the earlier trainee submission.
    expect(row?.traineeName).toBe("A. Trainee");
  });

  it("lets an admin act even though no TrainerAssignment links them to the trainee", async () => {
    asAdmin();
    const result = await signoff.submitTrainerSignOff(
      lessonId,
      trainee.id,
      null,
      form({ trainerName: "Admin Reviewer", result: "PASS" }),
    );
    expect(result).toEqual({ success: "Marked as Pass." });

    const row = await prisma.lessonSignOff.findUnique({ where: { lessonId_userId: { lessonId, userId: trainee.id } } });
    expect(row?.trainerResult).toBe("PASS");
  });
});

describe("markLessonComplete — the sign-off gate is trainee-only", () => {
  let freshLessonId: string;

  beforeAll(async () => {
    const program = await createProgram();
    const stage = await createStage(program.id, { order: 0, title: "Gate Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, { title: "Gate Course", lessonCount: 1 });
    freshLessonId = course.modules[0].lessons[0].id;
    await prisma.lesson.update({ where: { id: freshLessonId }, data: { requiresSignOff: true } });
    await enrol(trainee.id, course.id);
  });

  it("blocks completion until the trainee has signed", async () => {
    asTrainee();
    const result = await progress.markLessonComplete(freshLessonId);
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: "signoff_required" }));
  });

  it("allows completion once the trainee signs, before any trainer review exists", async () => {
    asTrainee();
    await signoff.submitTraineeSignOff(freshLessonId, null, form({ traineeName: "A. Trainee" }));
    const result = await progress.markLessonComplete(freshLessonId);
    expect(result.ok).toBe(true);
  });

  it("stays complete regardless of a later Refer for Review — the trainer's result never un-completes it", async () => {
    asAssignedTrainer();
    await signoff.submitTrainerSignOff(
      freshLessonId,
      trainee.id,
      null,
      form({ trainerName: "J. Trainer", result: "REFER", trainerNotes: "Revisit this." }),
    );

    const row = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: trainee.id, lessonId: freshLessonId } },
    });
    expect(row?.completedAt).not.toBeNull();

    // Re-running markLessonComplete (e.g. the trainee revisiting the lesson)
    // still succeeds — the trainer's REFER is not read by this gate at all.
    asTrainee();
    const result = await progress.markLessonComplete(freshLessonId);
    expect(result.ok).toBe(true);
  });
});
