/**
 * getContinueLearningInfo — the data behind the trainee dashboard's "what am
 * I currently learning" and "do I have an assessment coming up" answers.
 *
 * The property under test throughout: everything it returns is read off real
 * enrolment, lesson-progress and quiz-attempt rows. A trainee who isn't
 * enrolled in a stage's course gets nothing back for it, not a guess; a quiz
 * already passed never resurfaces as "coming up"; and the nearest upcoming
 * quiz can be a later lesson than the next lesson to actually read.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertDatabaseReachable,
  cleanup,
  completeLesson,
  createCourseWithLessons,
  createProgram,
  createStage,
  createUser,
  enrol,
} from "./helpers";
import { prisma } from "@/lib/prisma";

// stage-access pulls in `@/auth` for its session-derived helpers, and next-auth
// cannot load outside a Next runtime. These tests pass the user id explicitly.
vi.mock("@/auth", () => ({ auth: async () => null }));

const { getContinueLearningInfo, getNextLessonHrefForStage } = await import("@/lib/stage-access");

let trainee: Awaited<ReturnType<typeof createUser>>;

beforeAll(async () => {
  await assertDatabaseReachable();
  trainee = await createUser("TRAINEE", "continue-learning");
});

afterAll(async () => {
  await cleanup();
});

describe("getContinueLearningInfo — enrolment", () => {
  it("returns nothing for a stage the trainee is not enrolled in", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Unenrolled Stage" });
    await createCourseWithLessons(program.id, stage.id, { title: "Course", lessonCount: 2 });

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    expect(result).toEqual({ target: null, upcomingAssessment: null });
  });

  it("only ever surfaces a lesson from a course the trainee is actually enrolled in", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Mixed Enrolment Stage" });
    // Ordered first, but the trainee is not enrolled in it.
    const notEnrolled = await createCourseWithLessons(program.id, stage.id, {
      title: "Not Enrolled Course",
      lessonCount: 1,
      order: 0,
    });
    const enrolled = await createCourseWithLessons(program.id, stage.id, {
      title: "Enrolled Course",
      lessonCount: 1,
      order: 1,
    });
    await enrol(trainee.id, enrolled.id);

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    expect(result.target?.course.id).toBe(enrolled.id);
    expect(result.target?.course.id).not.toBe(notEnrolled.id);
  });
});

describe("getContinueLearningInfo — the continue target", () => {
  it("names the actual next lesson and its course", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Target Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Introduction to Property Law",
      lessonCount: 2,
    });
    await enrol(trainee.id, course.id);
    const [first, second] = course.modules[0].lessons;

    const before = await getContinueLearningInfo(stage.id, trainee.id);
    expect(before.target?.lesson.id).toBe(first.id);
    expect(before.target?.lesson.title).toBe(first.title);
    expect(before.target?.course.title).toBe(course.title);
    expect(before.target?.href).toBe(`/app/courses/${course.id}/lessons/${first.id}`);

    await completeLesson(trainee.id, first.id);

    const after = await getContinueLearningInfo(stage.id, trainee.id);
    expect(after.target?.lesson.id).toBe(second.id);
  });

  it("returns no target once every lesson in the stage is done", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Finished Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Short Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    await completeLesson(trainee.id, course.modules[0].lessons[0].id);

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    expect(result.target).toBeNull();
  });

  it("ignores an unpublished lesson", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Draft Lesson Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Draft Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    await prisma.lesson.create({
      data: {
        moduleId: course.modules[0].id,
        title: "ZZ-AUDIT draft lesson",
        slug: `zz-audit-draft-cl-${Date.now()}`,
        order: 5,
        isPublished: false,
      },
    });
    // Complete the one published lesson — the draft must not block or surface.
    await completeLesson(trainee.id, course.modules[0].lessons[0].id);

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    expect(result.target).toBeNull();
  });
});

describe("getContinueLearningInfo — the upcoming assessment", () => {
  async function attachQuiz(courseId: string, lessonId: string, title: string) {
    return prisma.quiz.create({
      data: { courseId, lessonId, title, passingScore: 80 },
    });
  }

  it("finds a quiz on the very next lesson", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Immediate Quiz Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Quiz Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    const lesson = course.modules[0].lessons[0];
    const quiz = await attachQuiz(course.id, lesson.id, "ZZ-AUDIT Knowledge Check");

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    expect(result.upcomingAssessment?.quizTitle).toBe(quiz.title);
    expect(result.upcomingAssessment?.lessonTitle).toBe(lesson.title);
    expect(result.upcomingAssessment?.href).toBe(
      `/app/courses/${course.id}/lessons/${lesson.id}/quiz`,
    );
  });

  it("looks further ahead than the reading target when the quiz sits on a later lesson", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Later Quiz Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Reading Then Quiz Course",
      lessonCount: 2,
    });
    await enrol(trainee.id, course.id);
    const [reading, quizLesson] = course.modules[0].lessons;
    const quiz = await attachQuiz(course.id, quizLesson.id, "ZZ-AUDIT Later Check");

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    // The trainee should read `reading` next, but the assessment ahead is on
    // the lesson after it — the two answers are allowed to disagree.
    expect(result.target?.lesson.id).toBe(reading.id);
    expect(result.upcomingAssessment?.quizTitle).toBe(quiz.title);
    expect(result.upcomingAssessment?.lessonTitle).toBe(quizLesson.title);
  });

  it("does not resurface a quiz the trainee has already passed", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Passed Quiz Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Passed Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    const lesson = course.modules[0].lessons[0];
    const quiz = await attachQuiz(course.id, lesson.id, "ZZ-AUDIT Already Passed");
    await prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId: trainee.id, score: 100, passed: true, answers: {} },
    });

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    expect(result.upcomingAssessment).toBeNull();
  });

  it("still surfaces the quiz after a failing attempt", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Failed Quiz Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Retry Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    const lesson = course.modules[0].lessons[0];
    const quiz = await attachQuiz(course.id, lesson.id, "ZZ-AUDIT Retry Check");
    await prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId: trainee.id, score: 20, passed: false, answers: {} },
    });

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    expect(result.upcomingAssessment?.quizTitle).toBe(quiz.title);
  });

  it("returns null when no lesson ahead carries a quiz", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "No Quiz Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Plain Course",
      lessonCount: 2,
    });
    await enrol(trainee.id, course.id);

    const result = await getContinueLearningInfo(stage.id, trainee.id);
    expect(result.upcomingAssessment).toBeNull();
  });
});

describe("getNextLessonHrefForStage — thin wrapper stays in sync", () => {
  it("returns exactly the target's own href", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Wrapper Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Wrapper Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);

    const [full, href] = await Promise.all([
      getContinueLearningInfo(stage.id, trainee.id),
      getNextLessonHrefForStage(stage.id, trainee.id),
    ]);
    expect(href).toBe(full.target?.href);
  });

  it("returns null once the stage has nothing left", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Wrapper Done Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Wrapper Done Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, course.id);
    await completeLesson(trainee.id, course.modules[0].lessons[0].id);

    expect(await getNextLessonHrefForStage(stage.id, trainee.id)).toBeNull();
  });
});
