/**
 * The admin authoring journey, exercised through the real server actions
 * against the real database:
 *
 *   create program → stage → course → module → lesson → content → publish →
 *   enrol a trainee → the trainee can see it.
 *
 * Every write is re-read from the database afterwards, which is the automated
 * equivalent of "create it, refresh the page, is it still there".
 *
 * Authorisation is checked at the action level, not by hiding nav items: each
 * action is called as a trainee and must be refused.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertDatabaseReachable,
  cleanup,
  createUser,
  enrol,
  trackProgram,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const session: { user: { id: string; name: string; email: string; role: string } | null } = {
  user: null,
};

vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

/** Captures redirects instead of throwing, so an action's write can still be asserted. */
const redirects: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirects.push(path);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const programs = await import("@/lib/actions/programs");
const stages = await import("@/lib/actions/stages");
const courses = await import("@/lib/actions/courses");
const modules = await import("@/lib/actions/modules");
const lessons = await import("@/lib/actions/lessons");
const enrollments = await import("@/lib/actions/enrollments");
const { isCoursePublished } = await import("@/lib/stage-access");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

let admin: Awaited<ReturnType<typeof createUser>>;
let trainee: Awaited<ReturnType<typeof createUser>>;

const asAdmin = () =>
  (session.user = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" });
const asTrainee = () =>
  (session.user = { id: trainee.id, name: trainee.name, email: trainee.email, role: "TRAINEE" });
const asNobody = () => (session.user = null);

/* Ids built up across the ordered authoring walkthrough. */
let programId = "";
let stageId = "";
let courseId = "";
let moduleId = "";
let lessonId = "";

beforeAll(async () => {
  await assertDatabaseReachable();
  admin = await createUser("ADMIN", "authoring");
  trainee = await createUser("TRAINEE", "authoring");
});

afterAll(async () => {
  await cleanup();
});

describe("Admin authoring walkthrough", () => {
  it("creates a program that persists and redirects to it", async () => {
    asAdmin();
    redirects.length = 0;
    await programs.createProgram(
      form({
        title: "ZZ-AUDIT Authoring Program",
        description: "Created by the automated audit suite.",
        status: "draft",
      }),
    );

    expect(redirects).toHaveLength(1);
    programId = redirects[0].split("/").pop()!;
    trackProgram(programId);

    const saved = await prisma.program.findUnique({ where: { id: programId } });
    expect(saved).not.toBeNull();
    expect(saved!.title).toBe("ZZ-AUDIT Authoring Program");
    expect(saved!.slug).toBe("zz-audit-authoring-program");
    expect(saved!.isPublished).toBe(false);
  });

  it("edits the program and the edit persists", async () => {
    asAdmin();
    await programs.updateProgram(
      programId,
      form({ title: "ZZ-AUDIT Authoring Program (edited)", description: "Edited." }),
    );
    const saved = await prisma.program.findUnique({ where: { id: programId } });
    expect(saved!.title).toBe("ZZ-AUDIT Authoring Program (edited)");
    expect(saved!.description).toBe("Edited.");
  });

  it("publishes the program", async () => {
    asAdmin();
    await programs.toggleProgramPublish(programId, true);
    expect((await prisma.program.findUnique({ where: { id: programId } }))!.isPublished).toBe(true);
  });

  it("creates a stage under the program", async () => {
    asAdmin();
    await stages.createStage(programId, form({ title: "ZZ-AUDIT Stage One" }));
    const saved = await prisma.stage.findFirst({ where: { programId } });
    expect(saved).not.toBeNull();
    stageId = saved!.id;
    expect(saved!.order).toBe(0);
    expect(saved!.requireAllLessons).toBe(true);
    await stages.toggleStagePublish(programId, stageId, true);
  });

  it("creates a course inside the stage", async () => {
    asAdmin();
    await courses.createCourse(programId, stageId, form({ title: "ZZ-AUDIT Course One" }));
    const saved = await prisma.course.findFirst({ where: { programId, stageId } });
    expect(saved).not.toBeNull();
    courseId = saved!.id;
    expect(saved!.isPublished).toBe(false);
    expect(saved!.stageId).toBe(stageId);
  });

  it("creates a module inside the course", async () => {
    asAdmin();
    await modules.createModule(programId, courseId, form({ title: "ZZ-AUDIT Module One" }));
    const saved = await prisma.module.findFirst({ where: { courseId } });
    expect(saved).not.toBeNull();
    moduleId = saved!.id;
  });

  it("creates a lesson inside the module", async () => {
    asAdmin();
    const created = await lessons.createLesson(
      programId,
      courseId,
      moduleId,
      form({ title: "ZZ-AUDIT Lesson One" }),
    );
    expect(created?.lessonId).toBeTruthy();
    lessonId = created!.lessonId;

    const saved = await prisma.lesson.findUnique({ where: { id: lessonId } });
    expect(saved!.moduleId).toBe(moduleId);
    expect(saved!.isPublished).toBe(false);
    expect(saved!.slug).toBe("zz-audit-lesson-one");
  });

  it("saves lesson content and it survives a re-read", async () => {
    asAdmin();
    const content = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Step one" }] },
        { type: "paragraph", content: [{ type: "text", text: "Body copy for step one." }] },
      ],
    };
    await lessons.updateLessonContent(programId, courseId, lessonId, content);

    const saved = await prisma.lesson.findUnique({ where: { id: lessonId } });
    expect(saved!.content).toEqual(content);
  });

  it("keeps trainer notes in a separate field from lesson content", async () => {
    asAdmin();
    const notes = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Trainer-only note." }] }],
    };
    await lessons.updateLessonTrainerNotes(programId, courseId, lessonId, notes);

    const saved = await prisma.lesson.findUnique({ where: { id: lessonId } });
    expect(saved!.trainerNotes).toEqual(notes);
    // Content was not clobbered by saving notes.
    expect(JSON.stringify(saved!.content)).toContain("Body copy for step one.");
  });

  it("publishes the lesson and the course", async () => {
    asAdmin();
    await lessons.toggleLessonPublish(programId, courseId, lessonId, true);
    await courses.toggleCoursePublish(programId, courseId, true);

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { program: true, stage: { include: { program: true } } },
    });
    expect(lesson!.isPublished).toBe(true);
    expect(isCoursePublished(course!)).toBe(true);
  });

  it("enrols the trainee, and the trainee can then reach the content", async () => {
    asAdmin();
    await enrollments.enrollTrainee(programId, courseId, form({ userId: trainee.id }));

    const enrolment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: trainee.id, courseId } },
    });
    expect(enrolment).not.toBeNull();

    const { getJourneyForUser } = await import("@/lib/stage-access");
    const journey = await getJourneyForUser(programId, trainee.id);
    expect(journey).toHaveLength(1);
    expect(journey[0].status).toBe("current");
    expect(journey[0].totalLessons).toBe(1);
    expect(journey[0].courses.map((c) => c.id)).toContain(courseId);
  });

  it("does not enrol a user who is not a trainee", async () => {
    asAdmin();
    await enrollments.enrollTrainee(programId, courseId, form({ userId: admin.id }));
    const enrolment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: admin.id, courseId } },
    });
    expect(enrolment).toBeNull();
  });

  it("enrolling twice does not create a duplicate", async () => {
    asAdmin();
    await enrollments.enrollTrainee(programId, courseId, form({ userId: trainee.id }));
    const count = await prisma.enrollment.count({ where: { userId: trainee.id, courseId } });
    expect(count).toBe(1);
  });

  it("unenrols the trainee", async () => {
    asAdmin();
    const enrolment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: trainee.id, courseId } },
    });
    await enrollments.unenrollTrainee(programId, courseId, enrolment!.id, new FormData());
    expect(
      await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: trainee.id, courseId } },
      }),
    ).toBeNull();
    // Put it back for later tests.
    await enrol(trainee.id, courseId);
  });
});

describe("Admin authoring — input validation", () => {
  it("ignores a blank program title rather than creating an untitled program", async () => {
    asAdmin();
    const before = await prisma.program.count();
    redirects.length = 0;
    await programs.createProgram(form({ title: "   " }));
    expect(redirects).toHaveLength(0);
    expect(await prisma.program.count()).toBe(before);
  });

  it("ignores a blank stage title", async () => {
    asAdmin();
    const before = await prisma.stage.count({ where: { programId } });
    await stages.createStage(programId, form({ title: "" }));
    expect(await prisma.stage.count({ where: { programId } })).toBe(before);
  });

  it("ignores a blank lesson title", async () => {
    asAdmin();
    const before = await prisma.lesson.count({ where: { moduleId } });
    const result = await lessons.createLesson(programId, courseId, moduleId, form({ title: "" }));
    expect(result).toBeUndefined();
    expect(await prisma.lesson.count({ where: { moduleId } })).toBe(before);
  });

  it("de-duplicates slugs rather than failing on the unique constraint", async () => {
    asAdmin();
    const second = await lessons.createLesson(
      programId,
      courseId,
      moduleId,
      form({ title: "ZZ-AUDIT Lesson One" }),
    );
    const saved = await prisma.lesson.findUnique({ where: { id: second!.lessonId } });
    expect(saved!.slug).toBe("zz-audit-lesson-one-2");
    await prisma.lesson.delete({ where: { id: second!.lessonId } });
  });

  it("never makes a stage its own prerequisite", async () => {
    asAdmin();
    await stages.updateStage(
      programId,
      stageId,
      form({ title: "ZZ-AUDIT Stage One", prerequisiteStageId: stageId, isPublished: "on" }),
    );
    const saved = await prisma.stage.findUnique({ where: { id: stageId } });
    expect(saved!.prerequisiteStageId).toBeNull();
  });

  it("clears the gating quiz when the quiz requirement is switched off", async () => {
    asAdmin();
    await stages.updateStage(
      programId,
      stageId,
      form({ title: "ZZ-AUDIT Stage One", requireAllLessons: "on", isPublished: "on" }),
    );
    const saved = await prisma.stage.findUnique({ where: { id: stageId } });
    expect(saved!.requireQuizPass).toBe(false);
    expect(saved!.gatingQuizId).toBeNull();
    expect(saved!.minQuizScore).toBeNull();
  });
});

describe("Authorisation is enforced at the action level", () => {
  const cases: [string, () => Promise<unknown>][] = [
    ["createProgram", () => programs.createProgram(form({ title: "ZZ-AUDIT hack" }))],
    ["updateProgram", () => programs.updateProgram(programId, form({ title: "ZZ-AUDIT hack" }))],
    ["toggleProgramPublish", () => programs.toggleProgramPublish(programId, false)],
    ["deleteProgram", () => programs.deleteProgram(programId, new FormData())],
    ["createStage", () => stages.createStage(programId, form({ title: "ZZ-AUDIT hack" }))],
    ["deleteStage", () => stages.deleteStage(programId, stageId, new FormData())],
    ["createCourse", () => courses.createCourse(programId, stageId, form({ title: "hack" }))],
    ["toggleCoursePublish", () => courses.toggleCoursePublish(programId, courseId, false)],
    ["deleteCourse", () => courses.deleteCourse(programId, courseId, new FormData())],
    ["createModule", () => modules.createModule(programId, courseId, form({ title: "hack" }))],
    ["deleteModule", () => modules.deleteModule(programId, courseId, moduleId, new FormData())],
    [
      "createLesson",
      () => lessons.createLesson(programId, courseId, moduleId, form({ title: "hack" })),
    ],
    ["toggleLessonPublish", () => lessons.toggleLessonPublish(programId, courseId, lessonId, false)],
    [
      "deleteLesson",
      () => lessons.deleteLesson(programId, courseId, moduleId, lessonId, new FormData()),
    ],
    [
      "updateLessonContent",
      () => lessons.updateLessonContent(programId, courseId, lessonId, { type: "doc" }),
    ],
    [
      "enrollTrainee",
      () => enrollments.enrollTrainee(programId, courseId, form({ userId: trainee.id })),
    ],
  ];

  for (const [name, call] of cases) {
    it(`refuses ${name} for a trainee`, async () => {
      asTrainee();
      await expect(call()).rejects.toThrow(/unauthorized/i);
    });

    it(`refuses ${name} with no session`, async () => {
      asNobody();
      await expect(call()).rejects.toThrow(/unauthorized/i);
    });
  }

  it("left the content untouched after all those refused calls", async () => {
    const program = await prisma.program.findUnique({ where: { id: programId } });
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    expect(program).not.toBeNull();
    expect(program!.isPublished).toBe(true);
    expect(lesson).not.toBeNull();
    expect(lesson!.isPublished).toBe(true);
    expect(JSON.stringify(lesson!.content)).toContain("Body copy for step one.");
  });
});

describe("Deletion cascades cleanly", () => {
  it("removes a lesson and its progress rows without orphans", async () => {
    asAdmin();
    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title: "ZZ-AUDIT disposable lesson",
        slug: `zz-audit-disposable-${Date.now()}`,
        isPublished: true,
        order: 50,
      },
    });
    await prisma.lessonProgress.create({
      data: { userId: trainee.id, lessonId: lesson.id, completedAt: new Date() },
    });

    await lessons.deleteLesson(programId, courseId, moduleId, lesson.id, new FormData());

    expect(await prisma.lesson.findUnique({ where: { id: lesson.id } })).toBeNull();
    expect(await prisma.lessonProgress.count({ where: { lessonId: lesson.id } })).toBe(0);
  });

  it("removes a module and the lessons under it", async () => {
    asAdmin();
    const mod = await prisma.module.create({
      data: {
        courseId,
        title: "ZZ-AUDIT disposable module",
        order: 50,
        lessons: {
          create: {
            title: "ZZ-AUDIT nested lesson",
            slug: `zz-audit-nested-${Date.now()}`,
            order: 0,
          },
        },
      },
      include: { lessons: true },
    });
    const nestedId = mod.lessons[0].id;

    await modules.deleteModule(programId, courseId, mod.id, new FormData());

    expect(await prisma.module.findUnique({ where: { id: mod.id } })).toBeNull();
    expect(await prisma.lesson.findUnique({ where: { id: nestedId } })).toBeNull();
  });

  it("removes a program and everything beneath it, including enrolments", async () => {
    asAdmin();
    redirects.length = 0;
    await programs.createProgram(form({ title: "ZZ-AUDIT Disposable Program", status: "draft" }));
    const disposableId = redirects[0].split("/").pop()!;
    const stage = await prisma.stage.create({
      data: {
        programId: disposableId,
        title: "ZZ-AUDIT disposable stage",
        slug: `zz-audit-disposable-stage-${Date.now()}`,
        order: 0,
      },
    });
    const course = await prisma.course.create({
      data: {
        programId: disposableId,
        stageId: stage.id,
        title: "ZZ-AUDIT disposable course",
        slug: `zz-audit-disposable-course-${Date.now()}`,
      },
    });
    await prisma.enrollment.create({ data: { userId: trainee.id, courseId: course.id } });

    await programs.deleteProgram(disposableId, new FormData());

    expect(await prisma.program.findUnique({ where: { id: disposableId } })).toBeNull();
    expect(await prisma.stage.findUnique({ where: { id: stage.id } })).toBeNull();
    expect(await prisma.course.findUnique({ where: { id: course.id } })).toBeNull();
    expect(await prisma.enrollment.count({ where: { courseId: course.id } })).toBe(0);
  });
});
