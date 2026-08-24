import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * A course is published either through its new Stage (real content) or, for the one
 * legacy course that predates the Stage system, through its old Program directly.
 */
export function isCoursePublished(course: {
  isPublished: boolean;
  program: { isPublished: boolean };
  stage: { isPublished: boolean; program: { isPublished: boolean } } | null;
}): boolean {
  if (!course.isPublished) return false;
  if (course.stage) return course.stage.isPublished && course.stage.program.isPublished;
  return course.program.isPublished;
}

/**
 * Whether a course sits under the given program.
 *
 * A course carries a required `programId` and, once it is placed in a stage,
 * that stage's program. The two can disagree — several courses here are owned
 * by a shell program while their stage lives in the real journey program — so
 * either match counts. Checking only `programId` made every course link on the
 * journey program's admin page 404.
 */
export function courseBelongsToProgram(
  course: { programId: string; stage: { programId: string } | null },
  programId: string
): boolean {
  return course.programId === programId || course.stage?.programId === programId;
}

export async function isStageComplete(stageId: string, userId: string): Promise<boolean> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: {
      requireAllLessons: true,
      requireQuizPass: true,
      requireTrainerApproval: true,
      gatingQuizId: true,
      minQuizScore: true,
      courses: {
        select: {
          modules: {
            select: { lessons: { where: { isPublished: true }, select: { id: true } } },
          },
        },
      },
    },
  });
  if (!stage) return false;

  if (stage.requireAllLessons) {
    const lessonIds = stage.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    // A stage with no published lessons yet (an empty placeholder) can never vacuously complete.
    if (lessonIds.length === 0) return false;
    const completedCount = await prisma.lessonProgress.count({
      where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
    });
    if (completedCount < lessonIds.length) return false;
  }

  if (stage.requireQuizPass) {
    if (!stage.gatingQuizId) return false;
    const attempt = await prisma.quizAttempt.findFirst({
      where: { quizId: stage.gatingQuizId, userId, score: { gte: stage.minQuizScore ?? 0 } },
      select: { id: true },
    });
    if (!attempt) return false;
  }

  if (stage.requireTrainerApproval) {
    const approval = await prisma.stageApproval.findUnique({
      where: { stageId_userId: { stageId, userId } },
      select: { id: true },
    });
    if (!approval) return false;
  }

  return true;
}

/** Single-level check per the gating rule: a stage is unlocked once its immediate prerequisite is complete. */
export async function isStageUnlockedForUser(stageId: string, userId: string): Promise<boolean> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { prerequisiteStageId: true },
  });
  if (!stage) return false;
  if (!stage.prerequisiteStageId) return true;
  return isStageComplete(stage.prerequisiteStageId, userId);
}

/** Session-derived, mirrors isEnrolledInCourse's signature style. */
export async function isEnrolledInProgram(programId: string): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;
  const count = await prisma.enrollment.count({
    where: { userId, course: { stage: { programId } } },
  });
  return count > 0;
}

export type ContinueLearningTarget = {
  course: { id: string; title: string };
  lesson: { id: string; title: string };
  href: string;
};

export type UpcomingAssessment = {
  quizTitle: string;
  lessonTitle: string;
  /** The lesson's own quiz page — the only quiz route a trainee can reach. */
  href: string;
};

/**
 * Where a trainee should pick back up in a stage, and the next quiz-bearing
 * lesson waiting for them in it — the data behind the dashboard's "what am I
 * currently learning" and "do I have an assessment coming up" answers.
 *
 * Only considers courses the trainee is actually enrolled in — access is
 * enrollment-gated (see isEnrolledInCourse), so a lesson in a
 * stage-unlocked-but-not-enrolled course would 404. Everything here is read
 * off real lesson/progress/quiz-attempt rows; nothing is inferred or assumed.
 */
export async function getContinueLearningInfo(
  stageId: string,
  userId: string
): Promise<{ target: ContinueLearningTarget | null; upcomingAssessment: UpcomingAssessment | null }> {
  const [courses, enrollments] = await Promise.all([
    prisma.course.findMany({
      where: { stageId },
      orderBy: { order: "asc" },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              where: { isPublished: true },
              orderBy: { order: "asc" },
              select: { id: true, title: true, quiz: { select: { id: true, title: true } } },
            },
          },
        },
      },
    }),
    prisma.enrollment.findMany({ where: { userId, course: { stageId } }, select: { courseId: true } }),
  ]);
  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const enrolledCourses = courses.filter((c) => enrolledCourseIds.has(c.id));

  const orderedLessons = enrolledCourses.flatMap((course) =>
    course.modules.flatMap((mod) =>
      mod.lessons.map((lesson) => ({
        courseId: course.id,
        courseTitle: course.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        quiz: lesson.quiz,
      }))
    )
  );
  const lessonIds = orderedLessons.map((l) => l.lessonId);
  const quizIds = orderedLessons.map((l) => l.quiz?.id).filter((id): id is string => !!id);

  const [completedProgress, passedAttempts] = await Promise.all([
    lessonIds.length
      ? prisma.lessonProgress.findMany({
          where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    quizIds.length
      ? prisma.quizAttempt.findMany({
          where: { userId, quizId: { in: quizIds }, passed: true },
          select: { quizId: true },
        })
      : Promise.resolve([]),
  ]);
  const completedSet = new Set(completedProgress.map((p) => p.lessonId));
  const passedQuizIds = new Set(passedAttempts.map((a) => a.quizId));

  let target: ContinueLearningTarget | null = null;
  let upcomingAssessment: UpcomingAssessment | null = null;

  for (const lesson of orderedLessons) {
    if (!target && !completedSet.has(lesson.lessonId)) {
      target = {
        course: { id: lesson.courseId, title: lesson.courseTitle },
        lesson: { id: lesson.lessonId, title: lesson.lessonTitle },
        href: `/app/courses/${lesson.courseId}/lessons/${lesson.lessonId}`,
      };
    }
    // The nearest lesson, in stage order, whose quiz has not yet been passed —
    // whether or not it's also the very next lesson.
    if (!upcomingAssessment && lesson.quiz && !passedQuizIds.has(lesson.quiz.id)) {
      upcomingAssessment = {
        quizTitle: lesson.quiz.title,
        lessonTitle: lesson.lessonTitle,
        href: `/app/courses/${lesson.courseId}/lessons/${lesson.lessonId}/quiz`,
      };
    }
    if (target && upcomingAssessment) break;
  }

  return { target, upcomingAssessment };
}

/** Thin wrapper over getContinueLearningInfo for callers that only need the href. */
export async function getNextLessonHrefForStage(stageId: string, userId: string): Promise<string | null> {
  return (await getContinueLearningInfo(stageId, userId)).target?.href ?? null;
}

/**
 * The program whose journey a trainee should be shown.
 *
 * Derived from what they are actually enrolled in — a trainee enrolled in
 * several programs gets the one they have the most courses in, tie-broken by
 * whichever they were enrolled in first. A trainee with no enrolments yet (a
 * brand-new hire, or staff previewing) falls back to the first published
 * program that has a stage structure, so the page still shows the pathway
 * rather than an empty state.
 */
export async function getPrimaryProgramForUser(
  userId: string
): Promise<{ id: string; title: string } | null> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: "asc" },
    select: {
      course: {
        select: {
          program: { select: { id: true, title: true } },
          stage: { select: { program: { select: { id: true, title: true } } } },
        },
      },
    },
  });

  if (enrollments.length > 0) {
    const byProgram = new Map<string, { id: string; title: string; count: number; first: number }>();
    enrollments.forEach((e, index) => {
      // A course carries both a direct programId and, once it sits in a stage,
      // that stage's program. Where they disagree the stage is authoritative —
      // it is the stage hierarchy that defines the training journey.
      const program = e.course.stage?.program ?? e.course.program;
      const existing = byProgram.get(program.id);
      if (existing) existing.count += 1;
      else byProgram.set(program.id, { ...program, count: 1, first: index });
    });
    const best = [...byProgram.values()].sort((a, b) => b.count - a.count || a.first - b.first)[0];
    return { id: best.id, title: best.title };
  }

  return prisma.program.findFirst({
    where: { isPublished: true, stages: { some: {} } },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });
}

export type StageJourneyStatus = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  order: number;
  isPublished: boolean;
  status: "completed" | "current" | "locked";
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  prerequisiteStageId: string | null;
  prerequisiteStageTitle: string | null;
  requireAllLessons: boolean;
  requireQuizPass: boolean;
  requireTrainerApproval: boolean;
  courses: { id: string; title: string }[];
  programCoverImageUrl: string | null;
};

/** Computes the full 9-stage journey for a user in a fixed small number of queries (no N+1). */
export async function getJourneyForUser(programId: string, userId: string): Promise<StageJourneyStatus[]> {
  const stages = await prisma.stage.findMany({
    where: { programId },
    orderBy: { order: "asc" },
    include: {
      prerequisiteStage: { select: { id: true, title: true } },
      program: { select: { coverImageUrl: true } },
      courses: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          modules: {
            select: { lessons: { where: { isPublished: true }, select: { id: true } } },
          },
        },
      },
    },
  });

  const allLessonIds = stages.flatMap((s) =>
    s.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)))
  );
  const completedProgress = allLessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: allLessonIds }, completedAt: { not: null } },
        select: { lessonId: true },
      })
    : [];
  const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));

  const approvals = await prisma.stageApproval.findMany({
    where: { userId, stageId: { in: stages.map((s) => s.id) } },
    select: { stageId: true },
  });
  const approvedStageIds = new Set(approvals.map((a) => a.stageId));

  const gatingQuizIds = stages.map((s) => s.gatingQuizId).filter((id): id is string => !!id);
  const quizAttempts = gatingQuizIds.length
    ? await prisma.quizAttempt.findMany({
        where: { userId, quizId: { in: gatingQuizIds } },
        select: { quizId: true, score: true },
      })
    : [];

  const completionByStageId = new Map<string, boolean>();
  for (const stage of stages) {
    const lessonIds = stage.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    let complete = true;
    if (stage.requireAllLessons) {
      complete = complete && lessonIds.length > 0 && lessonIds.every((id) => completedLessonIds.has(id));
    }
    if (stage.requireQuizPass) {
      const passed = stage.gatingQuizId
        ? quizAttempts.some((a) => a.quizId === stage.gatingQuizId && a.score >= (stage.minQuizScore ?? 0))
        : false;
      complete = complete && passed;
    }
    if (stage.requireTrainerApproval) {
      complete = complete && approvedStageIds.has(stage.id);
    }
    completionByStageId.set(stage.id, complete);
  }

  return stages.map((stage) => {
    const lessonIds = stage.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    const completedCount = lessonIds.filter((id) => completedLessonIds.has(id)).length;
    const isComplete = completionByStageId.get(stage.id) ?? false;
    const unlocked = !stage.prerequisiteStageId || (completionByStageId.get(stage.prerequisiteStageId) ?? false);

    const status: "completed" | "current" | "locked" = isComplete ? "completed" : unlocked ? "current" : "locked";

    return {
      id: stage.id,
      slug: stage.slug,
      title: stage.title,
      description: stage.description,
      order: stage.order,
      isPublished: stage.isPublished,
      status,
      totalLessons: lessonIds.length,
      completedLessons: completedCount,
      progressPercent: lessonIds.length > 0 ? Math.round((completedCount / lessonIds.length) * 100) : 0,
      prerequisiteStageId: stage.prerequisiteStageId,
      prerequisiteStageTitle: stage.prerequisiteStage?.title ?? null,
      requireAllLessons: stage.requireAllLessons,
      requireQuizPass: stage.requireQuizPass,
      requireTrainerApproval: stage.requireTrainerApproval,
      courses: stage.courses.map((c) => ({ id: c.id, title: c.title })),
      programCoverImageUrl: stage.program.coverImageUrl,
    };
  });
}
