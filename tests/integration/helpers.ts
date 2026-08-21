/**
 * Shared fixtures for the database-backed tests.
 *
 * Safety rules these helpers exist to enforce:
 *  - every record created here is namespaced with AUDIT_PREFIX and a run id,
 *    so it can never be confused with real content;
 *  - cleanup only ever deletes ids this run created;
 *  - all fixture people use @example.test addresses, which cannot be real.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const AUDIT_PREFIX = "ZZ-AUDIT";

/** Unique per test file run, so parallel or repeated runs never collide. */
export const RUN_ID = randomUUID().slice(0, 8);

export function label(name: string) {
  return `${AUDIT_PREFIX} ${RUN_ID} ${name}`;
}

/** Monotonic per-run counter so repeated fixtures never collide on a unique slug. */
let seq = 0;
function uniqueSuffix(name: string) {
  seq += 1;
  return `${AUDIT_PREFIX.toLowerCase()}-${RUN_ID}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${seq}`;
}

/** A bcrypt hash of "not-a-real-password" — fixtures never carry a usable secret. */
const FIXTURE_HASH = "$2b$10$Cj7Xm3P0F3mUuCkzJqZ0YuKsB1jQhWJq4gO0P1qzq2h8W9dU8oQ0K";

const createdUserIds: string[] = [];
const createdProgramIds: string[] = [];

export async function createUser(role: Role, tag: string) {
  const user = await prisma.user.create({
    data: {
      name: label(`${role} ${tag}`),
      // .test is a reserved TLD — these addresses can never reach a real inbox.
      email: `${role.toLowerCase()}.${tag}.${RUN_ID}@example.test`,
      passwordHash: FIXTURE_HASH,
      role,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

export async function createProgram(opts: { isPublished?: boolean } = {}) {
  const program = await prisma.program.create({
    data: {
      title: label("Program"),
      slug: uniqueSuffix("program"),
      description: "Synthetic program created by the automated audit suite.",
      isPublished: opts.isPublished ?? true,
    },
  });
  createdProgramIds.push(program.id);
  return program;
}

/** Registers a program created by some other means (e.g. a server action) for cleanup. */
export function trackProgram(programId: string) {
  createdProgramIds.push(programId);
}

export function trackUser(userId: string) {
  createdUserIds.push(userId);
}

type StageOpts = {
  order: number;
  title: string;
  prerequisiteStageId?: string | null;
  requireAllLessons?: boolean;
  requireQuizPass?: boolean;
  requireTrainerApproval?: boolean;
  minQuizScore?: number | null;
  isPublished?: boolean;
};

export async function createStage(programId: string, opts: StageOpts) {
  return prisma.stage.create({
    data: {
      programId,
      title: label(opts.title),
      slug: uniqueSuffix(opts.title),
      order: opts.order,
      isPublished: opts.isPublished ?? true,
      prerequisiteStageId: opts.prerequisiteStageId ?? null,
      requireAllLessons: opts.requireAllLessons ?? true,
      requireQuizPass: opts.requireQuizPass ?? false,
      requireTrainerApproval: opts.requireTrainerApproval ?? false,
      minQuizScore: opts.minQuizScore ?? null,
    },
  });
}

/** One course with one module and `lessonCount` published lessons. */
export async function createCourseWithLessons(
  programId: string,
  stageId: string,
  opts: { title: string; lessonCount: number; order?: number; isPublished?: boolean },
) {
  const course = await prisma.course.create({
    data: {
      programId,
      stageId,
      title: label(opts.title),
      slug: uniqueSuffix(opts.title),
      isPublished: opts.isPublished ?? true,
      order: opts.order ?? 0,
      modules: {
        create: {
          title: label(`${opts.title} module`),
          order: 0,
          lessons: {
            create: Array.from({ length: opts.lessonCount }, (_, i) => ({
              title: label(`${opts.title} lesson ${i + 1}`),
              slug: `${uniqueSuffix(opts.title)}-l${i + 1}`,
              order: i,
              isPublished: true,
            })),
          },
        },
      },
    },
    include: { modules: { include: { lessons: { orderBy: { order: "asc" } } } } },
  });
  return course;
}

export async function enrol(userId: string, courseId: string) {
  return prisma.enrollment.create({ data: { userId, courseId } });
}

export async function completeLesson(userId: string, lessonId: string) {
  return prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completedAt: new Date() },
    create: { userId, lessonId, completedAt: new Date() },
  });
}

/**
 * Deletes only what this run created. Programs cascade to stages, courses,
 * modules, lessons, quizzes and enrolments; users cascade to their progress.
 */
export async function cleanup() {
  for (const id of createdProgramIds) {
    await prisma.program.deleteMany({ where: { id } });
  }
  for (const id of createdUserIds) {
    await prisma.user.deleteMany({ where: { id } });
  }
  createdProgramIds.length = 0;
  createdUserIds.length = 0;
}

/** Guard used by the suites: refuses to run against a database holding no schema. */
export async function assertDatabaseReachable() {
  await prisma.$queryRaw`SELECT 1`;
}
