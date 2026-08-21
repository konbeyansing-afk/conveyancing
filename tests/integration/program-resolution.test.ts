/**
 * Regression tests for how a trainee's training journey is chosen.
 *
 * Bug 1: `/app` and `/app/journey` looked the program up by the literal title
 * "QLD Conveyancing Training Program". Any trainee enrolled in a different
 * program saw someone else's journey — every stage locked, no Continue CTA,
 * no way to progress — and renaming that one program would have blanked the
 * page for everybody.
 *
 * Bug 2: the first fix resolved the program through `Course.programId`. In
 * this database a stage-attached course's `programId` frequently points at a
 * different program than the stage it sits in, so that still picked the wrong
 * journey. The stage's program is authoritative.
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

// stage-access pulls in `@/auth` for its session-derived helpers, and next-auth
// cannot load outside a Next runtime. These tests pass the user id explicitly.
vi.mock("@/auth", () => ({ auth: async () => null }));

const { getPrimaryProgramForUser } = await import("@/lib/stage-access");

beforeAll(async () => {
  await assertDatabaseReachable();
});

afterAll(async () => {
  await cleanup();
});

describe("getPrimaryProgramForUser", () => {
  it("returns the program the trainee is actually enrolled in", async () => {
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Only Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Only Course",
      lessonCount: 1,
    });
    const trainee = await createUser("TRAINEE", "resolve-one");
    await enrol(trainee.id, course.id);

    const resolved = await getPrimaryProgramForUser(trainee.id);
    expect(resolved?.id).toBe(program.id);
  });

  it("prefers the stage's program when the course's own programId disagrees", async () => {
    // Reproduces the real data shape: a shell program owns the course row while
    // the course actually sits in a stage belonging to the real journey program.
    const shell = await createProgram({ isPublished: true });
    const journey = await createProgram({ isPublished: true });
    const stage = await createStage(journey.id, { order: 0, title: "Journey Stage" });

    const course = await prisma.course.create({
      data: {
        programId: shell.id, // deliberately not the stage's program
        stageId: stage.id,
        title: "ZZ-AUDIT mismatched course",
        slug: `zz-audit-mismatch-${Date.now()}`,
        isPublished: true,
        modules: {
          create: {
            title: "Module",
            order: 0,
            lessons: {
              create: {
                title: "Lesson",
                slug: `zz-audit-mismatch-lesson-${Date.now()}`,
                order: 0,
                isPublished: true,
              },
            },
          },
        },
      },
    });

    const trainee = await createUser("TRAINEE", "resolve-mismatch");
    await enrol(trainee.id, course.id);

    const resolved = await getPrimaryProgramForUser(trainee.id);
    expect(resolved?.id).toBe(journey.id);
    expect(resolved?.id).not.toBe(shell.id);
  });

  it("picks the program the trainee has the most courses in", async () => {
    const minor = await createProgram({ isPublished: true });
    const major = await createProgram({ isPublished: true });
    const minorStage = await createStage(minor.id, { order: 0, title: "Minor Stage" });
    const majorStage = await createStage(major.id, { order: 0, title: "Major Stage" });

    const trainee = await createUser("TRAINEE", "resolve-most");

    const minorCourse = await createCourseWithLessons(minor.id, minorStage.id, {
      title: "Minor Course",
      lessonCount: 1,
    });
    await enrol(trainee.id, minorCourse.id);

    for (const n of [1, 2]) {
      const c = await createCourseWithLessons(major.id, majorStage.id, {
        title: `Major Course ${n}`,
        lessonCount: 1,
        order: n,
      });
      await enrol(trainee.id, c.id);
    }

    const resolved = await getPrimaryProgramForUser(trainee.id);
    expect(resolved?.id).toBe(major.id);
  });

  it("falls back to a published program with stages when the trainee has no enrolments", async () => {
    const trainee = await createUser("TRAINEE", "resolve-none");
    const resolved = await getPrimaryProgramForUser(trainee.id);
    // The database always has at least one published, staged program.
    expect(resolved).not.toBeNull();
    const program = await prisma.program.findUnique({
      where: { id: resolved!.id },
      include: { stages: { select: { id: true } } },
    });
    expect(program!.isPublished).toBe(true);
    expect(program!.stages.length).toBeGreaterThan(0);
  });

  it("does not depend on any program being called a particular thing", async () => {
    // The old implementation matched on the literal title; renaming broke it.
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Renamed Stage" });
    const course = await createCourseWithLessons(program.id, stage.id, {
      title: "Renamed Course",
      lessonCount: 1,
    });
    const trainee = await createUser("TRAINEE", "resolve-rename");
    await enrol(trainee.id, course.id);

    await prisma.program.update({
      where: { id: program.id },
      data: { title: "ZZ-AUDIT Something Else Entirely" },
    });

    const resolved = await getPrimaryProgramForUser(trainee.id);
    expect(resolved?.id).toBe(program.id);
    expect(resolved?.title).toBe("ZZ-AUDIT Something Else Entirely");
  });
});

describe("Course counting", () => {
  it("does not count a stage-attached course twice", async () => {
    // Course.programId is required, so a course inside a stage is reachable
    // both through program.courses and through program.stages[].courses.
    // Concatenating the two relations used to double every count.
    const program = await createProgram({ isPublished: true });
    const stage = await createStage(program.id, { order: 0, title: "Counting Stage" });
    await createCourseWithLessons(program.id, stage.id, {
      title: "Counting Course",
      lessonCount: 2,
    });

    const loaded = await prisma.program.findUnique({
      where: { id: program.id },
      include: {
        courses: { include: { modules: { include: { lessons: true } } } },
        stages: { include: { courses: { include: { modules: { include: { lessons: true } } } } } },
      },
    });

    const naive = [...loaded!.courses, ...loaded!.stages.flatMap((s) => s.courses)];
    const deduped = [...new Map(naive.map((c) => [c.id, c])).values()];

    // The naive concat is what the bug did; the dedupe is what the pages do now.
    expect(naive.length).toBe(2);
    expect(deduped.length).toBe(1);
    expect(deduped.reduce((n, c) => n + c.modules.flatMap((m) => m.lessons).length, 0)).toBe(2);
  });
});
