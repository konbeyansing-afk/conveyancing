/**
 * The completion hierarchy: lesson → module → course → stage → program.
 *
 * The rule under test throughout is that a milestone is only ever granted when
 * the work underneath it is genuinely done — never because a page was visited,
 * never because an action was reached — and that it is withdrawn again if it
 * stops being true.
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

const { markLessonComplete } = await import("@/lib/actions/progress");
const { submitQuizAttempt } = await import("@/lib/actions/quiz-attempt");
const {
  isModuleComplete,
  isCourseComplete,
  isProgramComplete,
  completedAt,
  syncCompletionForStage,
} = await import("@/lib/completion");

type User = Awaited<ReturnType<typeof createUser>>;
let trainee: User;
let admin: User;

const asTrainee = () => {
  session.user = { id: trainee.id, name: trainee.name, email: trainee.email, role: "TRAINEE" };
};

beforeAll(async () => {
  await assertDatabaseReachable();
  trainee = await createUser("TRAINEE", "completion");
  admin = await createUser("ADMIN", "completion");
});

afterAll(async () => {
  await cleanup();
});

async function recordCount(scope: "MODULE" | "COURSE" | "STAGE" | "PROGRAM", userId: string) {
  return prisma.completionRecord.count({ where: { userId, scope } });
}

/* ================================================================== */

describe("Module completion", () => {
  it("requires every published lesson in the module", { timeout: 60_000 }, async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Mod Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Mod Course",
      lessonCount: 3,
    });
    await enrol(trainee.id, course.id);
    const moduleId = course.modules[0].id;
    const lessons = course.modules[0].lessons;

    asTrainee();
    expect(await isModuleComplete(moduleId, trainee.id)).toBe(false);

    await markLessonComplete(lessons[0].id);
    expect(await isModuleComplete(moduleId, trainee.id)).toBe(false);
    expect(await completedAt(trainee.id, "MODULE", moduleId)).toBeNull();

    await markLessonComplete(lessons[1].id);
    expect(await isModuleComplete(moduleId, trainee.id)).toBe(false);

    await markLessonComplete(lessons[2].id);
    expect(await isModuleComplete(moduleId, trainee.id)).toBe(true);
    expect(await completedAt(trainee.id, "MODULE", moduleId)).not.toBeNull();
  });

  it("does not count an unpublished lesson against the trainee", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Draft Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Draft Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    const moduleId = course.modules[0].id;

    await prisma.lesson.create({
      data: {
        moduleId,
        title: "ZZ-AUDIT unpublished",
        slug: `zz-audit-unpub-${Date.now()}`,
        order: 9,
        isPublished: false,
      },
    });

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    expect(await isModuleComplete(moduleId, trainee.id)).toBe(true);
  });

  it("never completes a module with no published lessons", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Empty Mod Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Empty Mod Course",
      lessonCount: 1,
    });
    const emptyModule = await prisma.module.create({
      data: { courseId: course.id, title: "ZZ-AUDIT empty module", order: 5 },
    });
    expect(await isModuleComplete(emptyModule.id, trainee.id)).toBe(false);
  });

  it("withdraws the milestone when a new lesson is published into a finished module", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Growing Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Growing Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    const moduleId = course.modules[0].id;

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    expect(await completedAt(trainee.id, "MODULE", moduleId)).not.toBeNull();

    // The admin adds more required work.
    const extra = await prisma.lesson.create({
      data: {
        moduleId,
        title: "ZZ-AUDIT added later",
        slug: `zz-audit-added-${Date.now()}`,
        order: 9,
        isPublished: true,
      },
    });

    expect(await isModuleComplete(moduleId, trainee.id)).toBe(false);

    // The next completion event brings the records back in line.
    await markLessonComplete(extra.id);
    expect(await isModuleComplete(moduleId, trainee.id)).toBe(true);
  });
});

describe("Course completion", () => {
  it("requires every module in the course", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Course Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Two Module Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);

    const secondModule = await prisma.module.create({
      data: {
        courseId: course.id,
        title: "ZZ-AUDIT second module",
        order: 1,
        lessons: {
          create: {
            title: "ZZ-AUDIT second module lesson",
            slug: `zz-audit-m2-${Date.now()}`,
            order: 0,
            isPublished: true,
          },
        },
      },
      include: { lessons: true },
    });

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    expect(await isCourseComplete(course.id, trainee.id)).toBe(false);
    expect(await completedAt(trainee.id, "COURSE", course.id)).toBeNull();

    await markLessonComplete(secondModule.lessons[0].id);
    expect(await isCourseComplete(course.id, trainee.id)).toBe(true);
    expect(await completedAt(trainee.id, "COURSE", course.id)).not.toBeNull();
  });

  it("ignores an empty placeholder module rather than being blocked by it", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Placeholder Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Placeholder Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    await prisma.module.create({
      data: { courseId: course.id, title: "ZZ-AUDIT placeholder", order: 8 },
    });

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    expect(await isCourseComplete(course.id, trainee.id)).toBe(true);
  });

  it("never completes a course with no published lessons at all", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Hollow Stage" });
    const course = await prisma.course.create({
      data: {
        programId: program.id,
        stageId: stage.id,
        title: "ZZ-AUDIT hollow course",
        slug: `zz-audit-hollow-${Date.now()}`,
        isPublished: true,
      },
    });
    expect(await isCourseComplete(course.id, trainee.id)).toBe(false);
  });
});

describe("Stage and program completion", () => {
  it("walks the whole chain and records each level exactly once", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Only Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Only Course",
      lessonCount: 2,
    });
    await enrol(trainee.id, course.id);
    const lessons = course.modules[0].lessons;

    asTrainee();
    const before = {
      module: await recordCount("MODULE", trainee.id),
      course: await recordCount("COURSE", trainee.id),
      stage: await recordCount("STAGE", trainee.id),
      program: await recordCount("PROGRAM", trainee.id),
    };

    await markLessonComplete(lessons[0].id);
    // Half done: nothing above lesson level yet.
    expect(await completedAt(trainee.id, "COURSE", course.id)).toBeNull();
    expect(await completedAt(trainee.id, "STAGE", stage.id)).toBeNull();
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).toBeNull();

    const result = await markLessonComplete(lessons[1].id);
    expect(result.ok).toBe(true);

    expect(await completedAt(trainee.id, "MODULE", course.modules[0].id)).not.toBeNull();
    expect(await completedAt(trainee.id, "COURSE", course.id)).not.toBeNull();
    expect(await completedAt(trainee.id, "STAGE", stage.id)).not.toBeNull();
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).not.toBeNull();

    expect(result.newlyCompleted?.map((c) => c.scope)).toEqual([
      "MODULE",
      "COURSE",
      "STAGE",
      "PROGRAM",
    ]);
    expect(result.programJustCompleted?.id).toBe(program.id);

    expect(await recordCount("MODULE", trainee.id)).toBe(before.module + 1);
    expect(await recordCount("COURSE", trainee.id)).toBe(before.course + 1);
    expect(await recordCount("STAGE", trainee.id)).toBe(before.stage + 1);
    expect(await recordCount("PROGRAM", trainee.id)).toBe(before.program + 1);
  });

  it("is idempotent — repeating the last lesson records nothing further", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Idempotent Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Idempotent Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    const after = await recordCount("PROGRAM", trainee.id);
    const firstDate = await completedAt(trainee.id, "PROGRAM", program.id);

    const repeat = await markLessonComplete(course.modules[0].lessons[0].id);
    expect(repeat.newlyCompleted).toEqual([]);
    expect(await recordCount("PROGRAM", trainee.id)).toBe(after);
    // The milestone date does not move.
    expect((await completedAt(trainee.id, "PROGRAM", program.id))?.getTime()).toBe(
      firstDate?.getTime(),
    );
  });

  it("requires every published stage before the program completes", async () => {
    const program = await createProgram({ isPublished: true });
    const stageOne = await createStage(program.id, { order: 0, title: "Chain One" });
    const stageTwo = await createStage(program.id, {
      order: 1,
      title: "Chain Two",
      prerequisiteStageId: stageOne.id,
    });
    const courseOne = await createCourseWithLessons(program.id, stageOne.id, {
      title: "Chain Course One",
      lessonCount: 1,
    });
    const courseTwo = await createCourseWithLessons(program.id, stageTwo.id, {
      title: "Chain Course Two",
      lessonCount: 1,
    });
    await enrol(trainee.id, courseOne.id);
    await enrol(trainee.id, courseTwo.id);

    asTrainee();
    await markLessonComplete(courseOne.modules[0].lessons[0].id);
    expect(await isProgramComplete(program.id, trainee.id)).toBe(false);
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).toBeNull();

    await markLessonComplete(courseTwo.modules[0].lessons[0].id);
    expect(await isProgramComplete(program.id, trainee.id)).toBe(true);
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).not.toBeNull();
  });

  it("ignores unpublished stages when deciding the program is complete", async () => {
    const program = await createProgram({ isPublished: true });
    const live = await createStage(program.id, { order: 0, title: "Live Stage" });
    await createStage(program.id, { order: 1, title: "Draft Stage", isPublished: false });
    const course = await createCourseWithLessons(program.id, live.id, {
      title: "Live Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    expect(await isProgramComplete(program.id, trainee.id)).toBe(true);
  });

  it("never completes a program that has no published stages", async () => {
    const program = await createProgram({ isPublished: true });
    expect(await isProgramComplete(program.id, trainee.id)).toBe(false);
  });

  it("holds the stage and program until a required quiz is passed", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Quiz Gate Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Quiz Gate Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);

    const quiz = await prisma.quiz.create({
      data: {
        courseId: course.id,
        title: "ZZ-AUDIT gate quiz",
        passingScore: 80,
        questions: {
          create: [0, 1].map((i) => ({
            prompt: `ZZ-AUDIT gate q${i}`,
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
      where: { id: stage.id },
      data: { requireQuizPass: true, gatingQuizId: quiz.id, minQuizScore: 80 },
    });

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    // Lessons are done but the gate is not.
    expect(await completedAt(trainee.id, "COURSE", course.id)).not.toBeNull();
    expect(await completedAt(trainee.id, "STAGE", stage.id)).toBeNull();
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).toBeNull();

    const answers = new FormData();
    for (const q of quiz.questions) {
      answers.set(`q_${q.id}`, q.choices.find((c) => c.isCorrect)!.id);
    }
    await submitQuizAttempt(quiz.id, null, answers);

    expect(await completedAt(trainee.id, "STAGE", stage.id)).not.toBeNull();
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).not.toBeNull();
  });

  it("holds the stage until a trainer signs it off, then releases it", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, {
      order: 0,
      title: "Signoff Stage",
      requireTrainerApproval: true,
    });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Signoff Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    expect(await completedAt(trainee.id, "STAGE", stage.id)).toBeNull();

    await prisma.stageApproval.create({
      data: { stageId: stage.id, userId: trainee.id, approvedById: admin.id },
    });
    await syncCompletionForStage(stage.id, trainee.id);
    expect(await completedAt(trainee.id, "STAGE", stage.id)).not.toBeNull();
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).not.toBeNull();

    // Withdrawing the sign-off withdraws the milestone too.
    await prisma.stageApproval.deleteMany({ where: { stageId: stage.id, userId: trainee.id } });
    await syncCompletionForStage(stage.id, trainee.id);
    expect(await completedAt(trainee.id, "STAGE", stage.id)).toBeNull();
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).toBeNull();
  });
});

describe("Completion cannot be granted by visiting a page", () => {
  it("records nothing when a locked-stage lesson is attempted directly", async () => {
    const program = await createProgram({ isPublished: true });
    const stageOne = await createStage(program.id, { order: 0, title: "Gate One" });
    const stageTwo = await createStage(program.id, {
      order: 1,
      title: "Gate Two",
      prerequisiteStageId: stageOne.id,
    });
    const courseOne = await createCourseWithLessons(program.id, stageOne.id, {
      title: "Gate Course One",
      lessonCount: 1,
    });
    const courseTwo = await createCourseWithLessons(program.id, stageTwo.id, {
      title: "Gate Course Two",
      lessonCount: 1,
    });
    await enrol(trainee.id, courseOne.id);
    await enrol(trainee.id, courseTwo.id);

    asTrainee();
    const blocked = await markLessonComplete(courseTwo.modules[0].lessons[0].id);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("stage_locked");

    expect(await completedAt(trainee.id, "MODULE", courseTwo.modules[0].id)).toBeNull();
    expect(await completedAt(trainee.id, "COURSE", courseTwo.id)).toBeNull();
    expect(await completedAt(trainee.id, "STAGE", stageTwo.id)).toBeNull();
    expect(await completedAt(trainee.id, "PROGRAM", program.id)).toBeNull();
  });

  it("records nothing for a trainee who is not enrolled", async () => {
    const outsider = await createUser("TRAINEE", "outsider-completion");
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Closed Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Closed Course",
      lessonCount: 1,
    });

    session.user = {
      id: outsider.id,
      name: outsider.name,
      email: outsider.email,
      role: "TRAINEE",
    };
    const result = await markLessonComplete(course.modules[0].lessons[0].id);
    expect(result.ok).toBe(false);
    expect(await recordCount("COURSE", outsider.id)).toBe(0);
    expect(await recordCount("PROGRAM", outsider.id)).toBe(0);
  });

  it("keeps one trainee's milestones away from another's", async () => {
    const bystander = await createUser("TRAINEE", "bystander");
    expect(await recordCount("MODULE", bystander.id)).toBe(0);
    expect(await recordCount("COURSE", bystander.id)).toBe(0);
    expect(await recordCount("STAGE", bystander.id)).toBe(0);
    expect(await recordCount("PROGRAM", bystander.id)).toBe(0);
  });
});

describe("Milestone records are cleaned up with their content", () => {
  it("deleting a course removes its completion records", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Disposable Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Disposable Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);

    asTrainee();
    await markLessonComplete(course.modules[0].lessons[0].id);
    expect(await completedAt(trainee.id, "COURSE", course.id)).not.toBeNull();

    await prisma.course.delete({ where: { id: course.id } });
    expect(await prisma.completionRecord.count({ where: { courseId: course.id } })).toBe(0);
  });
});
