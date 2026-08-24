import { prisma } from "@/lib/prisma";
import { isStageComplete } from "@/lib/stage-access";
import type { CompletionScope, Prisma } from "@prisma/client";

/**
 * The completion hierarchy: lesson → module → course → stage → program.
 *
 * Two things are deliberately kept apart here.
 *
 * The *boolean* — "has this trainee finished it?" — is always recomputed from
 * real progress rows. It is never read from a stored flag, so adding a lesson
 * to a published course correctly un-completes it for everyone until they do
 * the new work, and no amount of visiting a page can make it true.
 *
 * The *milestone* — "when did they first finish it?" — is written once into
 * CompletionRecord and never moved. Recomputation cannot recover that date,
 * and certificates depend on it.
 *
 * Nothing here trusts a client. Every function takes a userId the caller has
 * already established from the session.
 */

/** A level with no published lessons under it has nothing to complete. */
const NOTHING_TO_COMPLETE = false;

/* ------------------------------------------------------------------ */
/* Single-target booleans                                              */
/*                                                                     */
/* Convenience for callers that need one answer. The sync path below   */
/* does not use these — it loads the whole tree once instead.          */
/* ------------------------------------------------------------------ */

/** Every published lesson in the module has a completed progress row. */
export async function isModuleComplete(moduleId: string, userId: string): Promise<boolean> {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { lessons: { where: { isPublished: true }, select: { id: true } } },
  });
  if (!mod) return NOTHING_TO_COMPLETE;

  const lessonIds = mod.lessons.map((l) => l.id);
  if (lessonIds.length === 0) return NOTHING_TO_COMPLETE;

  const done = await prisma.lessonProgress.count({
    where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
  });
  return done === lessonIds.length;
}

/**
 * Every module in the course is complete.
 *
 * Modules holding no published lessons are skipped rather than blocking — an
 * empty placeholder module should not make a finished course incompletable —
 * but a course with no published lessons at all never completes.
 */
export async function isCourseComplete(courseId: string, userId: string): Promise<boolean> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      modules: {
        select: { lessons: { where: { isPublished: true }, select: { id: true } } },
      },
    },
  });
  if (!course) return NOTHING_TO_COMPLETE;

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (lessonIds.length === 0) return NOTHING_TO_COMPLETE;

  const done = await prisma.lessonProgress.count({
    where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
  });
  return done === lessonIds.length;
}

/** Every published stage in the program is complete. */
export async function isProgramComplete(programId: string, userId: string): Promise<boolean> {
  const snapshot = await loadProgramSnapshot(programId, userId);
  return snapshot ? snapshot.programComplete : NOTHING_TO_COMPLETE;
}

/* ------------------------------------------------------------------ */
/* Batched evaluation of a whole program                               */
/* ------------------------------------------------------------------ */

type Snapshot = {
  programId: string;
  programTitle: string;
  programComplete: boolean;
  modules: { id: string; title: string; complete: boolean }[];
  courses: { id: string; title: string; complete: boolean }[];
  stages: { id: string; title: string; complete: boolean }[];
};

/**
 * Loads everything needed to judge every level of one program for one user, in
 * a fixed five queries regardless of how big the program is.
 *
 * This runs on the hot path — every lesson a trainee finishes — so it must not
 * grow a query per stage or per module.
 */
async function loadProgramSnapshot(programId: string, userId: string): Promise<Snapshot | null> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: {
      id: true,
      title: true,
      stages: {
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          requireAllLessons: true,
          requireQuizPass: true,
          requireTrainerApproval: true,
          gatingQuizId: true,
          minQuizScore: true,
          courses: {
            select: {
              id: true,
              title: true,
              modules: {
                select: {
                  id: true,
                  title: true,
                  lessons: { where: { isPublished: true }, select: { id: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!program) return null;

  const allLessonIds = program.stages.flatMap((s) =>
    s.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id))),
  );
  const stageIds = program.stages.map((s) => s.id);
  const gatingQuizIds = program.stages
    .map((s) => s.gatingQuizId)
    .filter((id): id is string => !!id);

  const [progressRows, approvals, attempts] = await Promise.all([
    allLessonIds.length
      ? prisma.lessonProgress.findMany({
          where: { userId, lessonId: { in: allLessonIds }, completedAt: { not: null } },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    stageIds.length
      ? prisma.stageApproval.findMany({
          where: { userId, stageId: { in: stageIds } },
          select: { stageId: true },
        })
      : Promise.resolve([]),
    gatingQuizIds.length
      ? prisma.quizAttempt.findMany({
          where: { userId, quizId: { in: gatingQuizIds } },
          select: { quizId: true, score: true },
        })
      : Promise.resolve([]),
  ]);

  const done = new Set(progressRows.map((p) => p.lessonId));
  const approved = new Set(approvals.map((a) => a.stageId));

  const modules: Snapshot["modules"] = [];
  const courses: Snapshot["courses"] = [];
  const stages: Snapshot["stages"] = [];

  for (const stage of program.stages) {
    for (const course of stage.courses) {
      const courseLessonIds: string[] = [];

      for (const mod of course.modules) {
        const lessonIds = mod.lessons.map((l) => l.id);
        courseLessonIds.push(...lessonIds);
        modules.push({
          id: mod.id,
          title: mod.title,
          complete: lessonIds.length > 0 && lessonIds.every((id) => done.has(id)),
        });
      }

      courses.push({
        id: course.id,
        title: course.title,
        complete: courseLessonIds.length > 0 && courseLessonIds.every((id) => done.has(id)),
      });
    }

    const stageLessonIds = stage.courses.flatMap((c) =>
      c.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    );

    let complete = true;
    if (stage.requireAllLessons) {
      complete = stageLessonIds.length > 0 && stageLessonIds.every((id) => done.has(id));
    }
    if (complete && stage.requireQuizPass) {
      complete = stage.gatingQuizId
        ? attempts.some(
            (a) => a.quizId === stage.gatingQuizId && a.score >= (stage.minQuizScore ?? 0),
          )
        : false;
    }
    if (complete && stage.requireTrainerApproval) {
      complete = approved.has(stage.id);
    }
    stages.push({ id: stage.id, title: stage.title, complete });
  }

  return {
    programId: program.id,
    programTitle: program.title,
    // A program with no published stages has nothing to complete.
    programComplete: stages.length > 0 && stages.every((s) => s.complete),
    modules,
    courses,
    stages,
  };
}

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

type ScopeKey = "moduleId" | "courseId" | "stageId" | "programId";

const SCOPE_KEY: Record<CompletionScope, ScopeKey> = {
  MODULE: "moduleId",
  COURSE: "courseId",
  STAGE: "stageId",
  PROGRAM: "programId",
};

/**
 * Records that a trainee reached a milestone, if it is not already recorded.
 * Returns true when this call is the one that recorded it.
 */
export async function recordCompletion(
  userId: string,
  scope: CompletionScope,
  targetId: string,
): Promise<boolean> {
  const key = SCOPE_KEY[scope];
  const existing = await prisma.completionRecord.findFirst({
    where: { userId, scope, [key]: targetId } as Prisma.CompletionRecordWhereInput,
    select: { id: true },
  });
  if (existing) return false;

  try {
    await prisma.completionRecord.create({
      data: { userId, scope, [key]: targetId } as Prisma.CompletionRecordUncheckedCreateInput,
    });
    return true;
  } catch {
    // Lost a race against another request recording the same milestone.
    return false;
  }
}

export type CompletionSyncResult = {
  /** Milestones newly reached by this call, in hierarchy order. */
  newlyCompleted: { scope: CompletionScope; id: string; title: string }[];
  programCompleted: { id: string; title: string } | null;
};

const EMPTY_SYNC: CompletionSyncResult = { newlyCompleted: [], programCompleted: null };

/**
 * Brings a user's milestone records for one program into line with what is
 * actually true right now — recording what has newly become true and removing
 * anything that has stopped being true (a lesson added to a finished course, a
 * trainer sign-off withdrawn).
 *
 * Idempotent: running it twice records nothing the second time, and never moves
 * an existing milestone's date.
 */
export async function syncProgramCompletion(
  programId: string,
  userId: string,
): Promise<CompletionSyncResult> {
  const snapshot = await loadProgramSnapshot(programId, userId);
  if (!snapshot) return EMPTY_SYNC;

  const existing = await prisma.completionRecord.findMany({
    where: { userId },
    select: { id: true, scope: true, moduleId: true, courseId: true, stageId: true, programId: true },
  });

  const has = (scope: CompletionScope, targetId: string) =>
    existing.some((r) => r.scope === scope && r[SCOPE_KEY[scope]] === targetId);

  const toCreate: Prisma.CompletionRecordUncheckedCreateInput[] = [];
  const toDelete: string[] = [];
  const newlyCompleted: CompletionSyncResult["newlyCompleted"] = [];

  const reconcile = (
    scope: CompletionScope,
    items: { id: string; title: string; complete: boolean }[],
  ) => {
    for (const item of items) {
      const recorded = has(scope, item.id);
      if (item.complete && !recorded) {
        toCreate.push({
          userId,
          scope,
          [SCOPE_KEY[scope]]: item.id,
        } as Prisma.CompletionRecordUncheckedCreateInput);
        newlyCompleted.push({ scope, id: item.id, title: item.title });
      } else if (!item.complete && recorded) {
        const row = existing.find((r) => r.scope === scope && r[SCOPE_KEY[scope]] === item.id);
        if (row) toDelete.push(row.id);
      }
    }
  };

  reconcile("MODULE", snapshot.modules);
  reconcile("COURSE", snapshot.courses);
  reconcile("STAGE", snapshot.stages);
  reconcile("PROGRAM", [
    { id: snapshot.programId, title: snapshot.programTitle, complete: snapshot.programComplete },
  ]);

  if (toDelete.length > 0) {
    await prisma.completionRecord.deleteMany({ where: { id: { in: toDelete } } });
  }
  if (toCreate.length > 0) {
    // Skips anything a concurrent request recorded first rather than failing
    // the trainee's request on a unique-constraint race.
    await prisma.completionRecord.createMany({ data: toCreate, skipDuplicates: true });
  }

  return {
    newlyCompleted,
    programCompleted: snapshot.programComplete
      ? { id: snapshot.programId, title: snapshot.programTitle }
      : null,
  };
}

/** Resolves the program a lesson belongs to, then syncs it. */
export async function syncCompletionForLesson(
  lessonId: string,
  userId: string,
): Promise<CompletionSyncResult> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      module: {
        select: {
          course: {
            select: {
              programId: true,
              stage: { select: { programId: true } },
            },
          },
        },
      },
    },
  });
  if (!lesson) return EMPTY_SYNC;

  const course = lesson.module.course;
  // Where a course's own programId and its stage's program disagree, the stage
  // is authoritative — see courseBelongsToProgram in stage-access.
  return syncProgramCompletion(course.stage?.programId ?? course.programId, userId);
}

/** Resolves the program a stage belongs to, then syncs it. */
export async function syncCompletionForStage(
  stageId: string,
  userId: string,
): Promise<CompletionSyncResult> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { programId: true },
  });
  if (!stage) return EMPTY_SYNC;
  return syncProgramCompletion(stage.programId, userId);
}

/* ------------------------------------------------------------------ */
/* Reading milestones back                                             */
/* ------------------------------------------------------------------ */

/** When a trainee completed something, or null if they have not. */
export async function completedAt(
  userId: string,
  scope: CompletionScope,
  targetId: string,
): Promise<Date | null> {
  const record = await prisma.completionRecord.findFirst({
    where: { userId, scope, [SCOPE_KEY[scope]]: targetId } as Prisma.CompletionRecordWhereInput,
    select: { completedAt: true },
  });
  return record?.completedAt ?? null;
}

/** Re-exported so callers needing one stage's rule do not reach past this module. */
export { isStageComplete };
