/**
 * The sequential training system, tested against the real database.
 *
 * This is the core promise of the platform: a trainee works through stages in
 * order, cannot open or complete a locked stage — including by calling the
 * server action directly rather than clicking through the UI — and their
 * progress survives a refresh and a new session.
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

/* The session the code under test sees. Swapped per test via `asUser`. */
const session: { user: { id: string; name: string; email: string; role: string } | null } = {
  user: null,
};

vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

// Imported after the mocks so they pick up the mocked `@/auth`.
const { markLessonComplete } = await import("@/lib/actions/progress");
const { submitQuizAttempt } = await import("@/lib/actions/quiz-attempt");
const { getJourneyForUser, isStageComplete, isStageUnlockedForUser, isCoursePublished } =
  await import("@/lib/stage-access");

type Ctx = Awaited<ReturnType<typeof buildFixture>>;
let ctx: Ctx;

function asUser(u: { id: string; name: string; email: string; role: string } | null) {
  session.user = u;
}

async function buildFixture() {
  const program = await createProgram({ isPublished: true });
  const admin = await createUser("ADMIN", "journey");
  const trainee = await createUser("TRAINEE", "journey");
  const other = await createUser("TRAINEE", "outsider");

  const stage1 = await createStage(program.id, { order: 0, title: "Stage One" });
  const stage2 = await createStage(program.id, {
    order: 1,
    title: "Stage Two",
    prerequisiteStageId: stage1.id,
  });
  const stage3 = await createStage(program.id, {
    order: 2,
    title: "Stage Three",
    prerequisiteStageId: stage2.id,
  });

  const course1 = await createCourseWithLessons(program.id, stage1.id, {
    title: "Course One",
    lessonCount: 2,
  });
  const course2 = await createCourseWithLessons(program.id, stage2.id, {
    title: "Course Two",
    lessonCount: 1,
  });
  const course3 = await createCourseWithLessons(program.id, stage3.id, {
    title: "Course Three",
    lessonCount: 1,
  });

  for (const c of [course1, course2, course3]) await enrol(trainee.id, c.id);

  return {
    program,
    admin,
    trainee,
    other,
    stage1,
    stage2,
    stage3,
    course1,
    course2,
    course3,
    lessons1: course1.modules[0].lessons,
    lesson2: course2.modules[0].lessons[0],
    lesson3: course3.modules[0].lessons[0],
  };
}

beforeAll(async () => {
  await assertDatabaseReachable();
  ctx = await buildFixture();
});

afterAll(async () => {
  await cleanup();
});

const traineeSession = () => ({
  id: ctx.trainee.id,
  name: ctx.trainee.name,
  email: ctx.trainee.email,
  role: "TRAINEE",
});

describe("Sequential unlocking", () => {
  it("starts with only the first stage available and everything after it locked", async () => {
    asUser(traineeSession());
    const journey = await getJourneyForUser(ctx.program.id, ctx.trainee.id);

    expect(journey.map((s) => s.status)).toEqual(["current", "locked", "locked"]);
    expect(journey[0].totalLessons).toBe(2);
    expect(journey[0].completedLessons).toBe(0);
    expect(journey[0].progressPercent).toBe(0);
  });

  it("names the prerequisite that is holding a locked stage", async () => {
    const journey = await getJourneyForUser(ctx.program.id, ctx.trainee.id);
    expect(journey[1].prerequisiteStageId).toBe(ctx.stage1.id);
    expect(journey[1].prerequisiteStageTitle).toBe(ctx.stage1.title);
  });

  it("does not unlock stage 2 on partial completion of stage 1", async () => {
    asUser(traineeSession());
    const result = await markLessonComplete(ctx.lessons1[0].id);
    expect(result.ok).toBe(true);

    expect(await isStageComplete(ctx.stage1.id, ctx.trainee.id)).toBe(false);
    expect(await isStageUnlockedForUser(ctx.stage2.id, ctx.trainee.id)).toBe(false);

    const journey = await getJourneyForUser(ctx.program.id, ctx.trainee.id);
    expect(journey[0].completedLessons).toBe(1);
    expect(journey[0].progressPercent).toBe(50);
    expect(journey[1].status).toBe("locked");
  });

  it("refuses to complete a lesson inside a locked stage, even called directly", async () => {
    asUser(traineeSession());
    const result = await markLessonComplete(ctx.lesson2.id);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("stage_locked");

    // Nothing was written.
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: ctx.trainee.id, lessonId: ctx.lesson2.id } },
    });
    expect(progress).toBeNull();
  });

  it("unlocks the next stage — and only the next one — when the stage completes", async () => {
    asUser(traineeSession());
    const result = await markLessonComplete(ctx.lessons1[1].id);

    expect(result.ok).toBe(true);
    expect(result.stageJustCompleted?.id).toBe(ctx.stage1.id);

    expect(await isStageComplete(ctx.stage1.id, ctx.trainee.id)).toBe(true);
    expect(await isStageUnlockedForUser(ctx.stage2.id, ctx.trainee.id)).toBe(true);
    // Stage 3 stays locked: its own prerequisite (stage 2) is not complete.
    expect(await isStageUnlockedForUser(ctx.stage3.id, ctx.trainee.id)).toBe(false);

    const journey = await getJourneyForUser(ctx.program.id, ctx.trainee.id);
    expect(journey.map((s) => s.status)).toEqual(["completed", "current", "locked"]);
  });

  it("still refuses stage 3's lesson while stage 2 is unfinished", async () => {
    asUser(traineeSession());
    const result = await markLessonComplete(ctx.lesson3.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("stage_locked");
  });

  it("lets the trainee work through the newly unlocked stage", async () => {
    asUser(traineeSession());
    const result = await markLessonComplete(ctx.lesson2.id);
    expect(result.ok).toBe(true);
    expect(result.stageJustCompleted?.id).toBe(ctx.stage2.id);

    const journey = await getJourneyForUser(ctx.program.id, ctx.trainee.id);
    expect(journey.map((s) => s.status)).toEqual(["completed", "completed", "current"]);
  });

  it("does not report a stage as newly completed twice", async () => {
    asUser(traineeSession());
    // Re-completing an already-complete lesson must not re-fire the celebration.
    const result = await markLessonComplete(ctx.lessons1[0].id);
    expect(result.ok).toBe(true);
    expect(result.stageJustCompleted).toBeUndefined();
  });

  it("never treats an empty stage as vacuously complete", async () => {
    const emptyStage = await createStage(ctx.program.id, {
      order: 3,
      title: "Empty Stage",
      prerequisiteStageId: null,
    });
    expect(await isStageComplete(emptyStage.id, ctx.trainee.id)).toBe(false);
  });
});

describe("Progress persistence", () => {
  it("keeps completion after re-reading from the database (refresh)", async () => {
    const rows = await prisma.lessonProgress.findMany({
      where: { userId: ctx.trainee.id, completedAt: { not: null } },
      select: { lessonId: true },
    });
    const ids = rows.map((r) => r.lessonId);
    expect(ids).toContain(ctx.lessons1[0].id);
    expect(ids).toContain(ctx.lessons1[1].id);
    expect(ids).toContain(ctx.lesson2.id);
  });

  it("keeps the same journey after a fresh session for the same user (logout/login)", async () => {
    asUser(null);
    // Journey is computed from the database by user id, not from any session state.
    const journey = await getJourneyForUser(ctx.program.id, ctx.trainee.id);
    expect(journey.map((s) => s.status)).toEqual(["completed", "completed", "current", "current"]);
  });

  it("does not leak one trainee's progress to another", async () => {
    const journey = await getJourneyForUser(ctx.program.id, ctx.other.id);
    expect(journey[0].completedLessons).toBe(0);
    expect(journey.slice(0, 3).map((s) => s.status)).toEqual(["current", "locked", "locked"]);
  });

  it("records completion once per user and lesson, not once per click", async () => {
    asUser(traineeSession());
    await markLessonComplete(ctx.lessons1[0].id);
    await markLessonComplete(ctx.lessons1[0].id);
    const count = await prisma.lessonProgress.count({
      where: { userId: ctx.trainee.id, lessonId: ctx.lessons1[0].id },
    });
    expect(count).toBe(1);
  });
});

describe("Enrolment gates access, not publication alone", () => {
  it("refuses to complete a lesson on a course the trainee is not enrolled in", async () => {
    asUser({
      id: ctx.other.id,
      name: ctx.other.name,
      email: ctx.other.email,
      role: "TRAINEE",
    });
    const result = await markLessonComplete(ctx.lessons1[0].id);
    expect(result.ok).toBe(false);

    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: ctx.other.id, lessonId: ctx.lessons1[0].id } },
    });
    expect(progress).toBeNull();
  });

  it("refuses to complete anything with no session at all", async () => {
    asUser(null);
    const result = await markLessonComplete(ctx.lessons1[0].id);
    expect(result.ok).toBe(false);
  });

  it("refuses an unpublished lesson for a trainee", async () => {
    const draft = await prisma.lesson.create({
      data: {
        moduleId: ctx.course1.modules[0].id,
        title: "ZZ-AUDIT draft lesson",
        slug: `zz-audit-draft-${Date.now()}`,
        order: 99,
        isPublished: false,
      },
    });
    asUser(traineeSession());
    const result = await markLessonComplete(draft.id);
    expect(result.ok).toBe(false);
    await prisma.lesson.delete({ where: { id: draft.id } });
  });

  it("treats a course in an unpublished stage as unpublished", async () => {
    const course = await prisma.course.findUnique({
      where: { id: ctx.course1.id },
      include: { program: true, stage: { include: { program: true } } },
    });
    expect(isCoursePublished(course!)).toBe(true);

    await prisma.stage.update({ where: { id: ctx.stage1.id }, data: { isPublished: false } });
    const hidden = await prisma.course.findUnique({
      where: { id: ctx.course1.id },
      include: { program: true, stage: { include: { program: true } } },
    });
    expect(isCoursePublished(hidden!)).toBe(false);

    await prisma.stage.update({ where: { id: ctx.stage1.id }, data: { isPublished: true } });
  });

  it("treats a course in an unpublished program as unpublished", async () => {
    await prisma.program.update({ where: { id: ctx.program.id }, data: { isPublished: false } });
    const hidden = await prisma.course.findUnique({
      where: { id: ctx.course1.id },
      include: { program: true, stage: { include: { program: true } } },
    });
    expect(isCoursePublished(hidden!)).toBe(false);
    await prisma.program.update({ where: { id: ctx.program.id }, data: { isPublished: true } });
  });
});

describe("Quiz-gated stages", () => {
  it("grades an attempt and only completes the stage on a passing score", async () => {
    // A separate program so the gating rules do not disturb the journey fixture.
    const program = await createProgram({ isPublished: true });
    const stageA = await createStage(program.id, { order: 0, title: "Quiz Stage" });
    const stageB = await createStage(program.id, {
      order: 1,
      title: "After Quiz",
      prerequisiteStageId: stageA.id,
    });
    const course = await createCourseWithLessons(program.id, stageA.id, {
      title: "Quiz Course",
      lessonCount: 1,
    });
    await enrol(ctx.trainee.id, course.id);

    const quiz = await prisma.quiz.create({
      data: {
        courseId: course.id,
        title: "ZZ-AUDIT gating quiz",
        passingScore: 80,
        questions: {
          create: [0, 1, 2, 3, 4].map((i) => ({
            prompt: `ZZ-AUDIT question ${i + 1}`,
            type: "MULTIPLE_CHOICE" as const,
            order: i,
            choices: {
              create: [
                { text: "right", isCorrect: true, order: 0 },
                { text: "wrong", isCorrect: false, order: 1 },
              ],
            },
          })),
        },
      },
      include: { questions: { include: { choices: true }, orderBy: { order: "asc" } } },
    });

    await prisma.stage.update({
      where: { id: stageA.id },
      data: {
        requireAllLessons: true,
        requireQuizPass: true,
        gatingQuizId: quiz.id,
        minQuizScore: 80,
      },
    });

    asUser(traineeSession());
    await markLessonComplete(course.modules[0].lessons[0].id);
    // All lessons done, but the quiz has not been passed.
    expect(await isStageComplete(stageA.id, ctx.trainee.id)).toBe(false);
    expect(await isStageUnlockedForUser(stageB.id, ctx.trainee.id)).toBe(false);

    // Fail it: one right out of five.
    const failing = new FormData();
    failing.set(`q_${quiz.questions[0].id}`, quiz.questions[0].choices.find((c) => c.isCorrect)!.id);
    for (const q of quiz.questions.slice(1)) {
      failing.set(`q_${q.id}`, q.choices.find((c) => !c.isCorrect)!.id);
    }
    const failed = await submitQuizAttempt(quiz.id, null, failing);
    expect(failed?.score).toBe(20);
    expect(failed?.passed).toBe(false);
    expect(await isStageComplete(stageA.id, ctx.trainee.id)).toBe(false);

    // Pass it.
    const passing = new FormData();
    for (const q of quiz.questions) {
      passing.set(`q_${q.id}`, q.choices.find((c) => c.isCorrect)!.id);
    }
    const passedAttempt = await submitQuizAttempt(quiz.id, null, passing);
    expect(passedAttempt?.score).toBe(100);
    expect(passedAttempt?.passed).toBe(true);

    expect(await isStageComplete(stageA.id, ctx.trainee.id)).toBe(true);
    expect(await isStageUnlockedForUser(stageB.id, ctx.trainee.id)).toBe(true);

    // Both attempts were stored — the trainee's history is not overwritten.
    const attempts = await prisma.quizAttempt.count({
      where: { quizId: quiz.id, userId: ctx.trainee.id },
    });
    expect(attempts).toBe(2);
  });

  it("blocks a PASS_QUIZ lesson until the quiz has actually been passed", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Assessment Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Assessment Course",
      lessonCount: 1,
    });
    await enrol(ctx.trainee.id, course.id);
    const lesson = course.modules[0].lessons[0];

    const quiz = await prisma.quiz.create({
      data: {
        courseId: course.id,
        lessonId: lesson.id,
        title: "ZZ-AUDIT lesson quiz",
        passingScore: 100,
        questions: {
          create: [
            {
              prompt: "ZZ-AUDIT single question",
              type: "MULTIPLE_CHOICE" as const,
              order: 0,
              choices: {
                create: [
                  { text: "right", isCorrect: true, order: 0 },
                  { text: "wrong", isCorrect: false, order: 1 },
                ],
              },
            },
          ],
        },
      },
      include: { questions: { include: { choices: true } } },
    });
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { completionRequirement: "PASS_QUIZ" },
    });

    asUser(traineeSession());
    const blocked = await markLessonComplete(lesson.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("quiz_required");

    const wrong = new FormData();
    wrong.set(
      `q_${quiz.questions[0].id}`,
      quiz.questions[0].choices.find((c) => !c.isCorrect)!.id,
    );
    await submitQuizAttempt(quiz.id, null, wrong);
    expect((await markLessonComplete(lesson.id)).reason).toBe("quiz_required");

    const right = new FormData();
    right.set(`q_${quiz.questions[0].id}`, quiz.questions[0].choices.find((c) => c.isCorrect)!.id);
    await submitQuizAttempt(quiz.id, null, right);
    expect((await markLessonComplete(lesson.id)).ok).toBe(true);
  });

  it("scores an unanswered question as wrong rather than skipping it", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Skip Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Skip Course",
      lessonCount: 1,
    });
    await enrol(ctx.trainee.id, course.id);

    const quiz = await prisma.quiz.create({
      data: {
        courseId: course.id,
        title: "ZZ-AUDIT skip quiz",
        passingScore: 50,
        questions: {
          create: [0, 1].map((i) => ({
            prompt: `ZZ-AUDIT skip question ${i + 1}`,
            type: "MULTIPLE_CHOICE" as const,
            order: i,
            choices: {
              create: [
                { text: "right", isCorrect: true, order: 0 },
                { text: "wrong", isCorrect: false, order: 1 },
              ],
            },
          })),
        },
      },
      include: { questions: { include: { choices: true }, orderBy: { order: "asc" } } },
    });

    asUser(traineeSession());
    const partial = new FormData();
    partial.set(`q_${quiz.questions[0].id}`, quiz.questions[0].choices.find((c) => c.isCorrect)!.id);
    // Second question deliberately not answered.
    const result = await submitQuizAttempt(quiz.id, null, partial);
    expect(result?.score).toBe(50);
  });

  it("refuses a quiz submission from a trainee who is not enrolled", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Closed Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Closed Course",
      lessonCount: 1,
    });
    const quiz = await prisma.quiz.create({
      data: {
        courseId: course.id,
        title: "ZZ-AUDIT closed quiz",
        passingScore: 50,
        questions: {
          create: [
            {
              prompt: "ZZ-AUDIT closed question",
              type: "MULTIPLE_CHOICE" as const,
              order: 0,
              choices: { create: [{ text: "right", isCorrect: true, order: 0 }] },
            },
          ],
        },
      },
    });

    asUser({ id: ctx.other.id, name: ctx.other.name, email: ctx.other.email, role: "TRAINEE" });
    const result = await submitQuizAttempt(quiz.id, null, new FormData());
    expect(result).toBeNull();

    const attempts = await prisma.quizAttempt.count({
      where: { quizId: quiz.id, userId: ctx.other.id },
    });
    expect(attempts).toBe(0);
  });
});

describe("Trainer-approval gated stages", () => {
  it("holds the stage until a trainer signs it off, then releases it", async () => {
    const program = await createProgram({ isPublished: true });
    const stageA = await createStage(program.id, {
      order: 0,
      title: "Shadowing",
      requireTrainerApproval: true,
    });
    const stageB = await createStage(program.id, {
      order: 1,
      title: "Production Ready",
      prerequisiteStageId: stageA.id,
    });
    const course = await createCourseWithLessons(program.id, stageA.id, {
      title: "Shadowing Course",
      lessonCount: 1,
    });
    await enrol(ctx.trainee.id, course.id);

    asUser(traineeSession());
    await markLessonComplete(course.modules[0].lessons[0].id);

    // Lessons are done, but the sign-off is not there yet.
    expect(await isStageComplete(stageA.id, ctx.trainee.id)).toBe(false);
    expect(await isStageUnlockedForUser(stageB.id, ctx.trainee.id)).toBe(false);

    await prisma.stageApproval.create({
      data: { stageId: stageA.id, userId: ctx.trainee.id, approvedById: ctx.admin.id },
    });

    expect(await isStageComplete(stageA.id, ctx.trainee.id)).toBe(true);
    expect(await isStageUnlockedForUser(stageB.id, ctx.trainee.id)).toBe(true);

    // Revoking the sign-off re-locks the next stage.
    await prisma.stageApproval.deleteMany({
      where: { stageId: stageA.id, userId: ctx.trainee.id },
    });
    expect(await isStageUnlockedForUser(stageB.id, ctx.trainee.id)).toBe(false);
  });
});
