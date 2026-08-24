import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/trainer-scope";
import { traineeScopeFilter } from "@/lib/trainer-scope";

/**
 * What supervision actually needs to know about a trainee, in a fixed number
 * of queries no matter how many trainees there are.
 *
 * Both the trainer's list and the admin's list read this, so "behind" means the
 * same thing on both and there is only one place to change it.
 */

export type TraineeOverview = {
  id: string;
  name: string;
  email: string;
  enrolledCourses: number;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  /** Stages waiting on a trainer, for stages that ask for a sign-off. */
  awaitingSignOff: { stageId: string; stageTitle: string }[];
  certificatesPending: number;
  certificatesIssued: number;
  lastActivityAt: Date | null;
  /** No completed lesson in the last fortnight, while still having work left. */
  isBehind: boolean;
};

const STALE_AFTER_DAYS = 14;

export async function getTraineeOverviews(actor: Actor): Promise<TraineeOverview[]> {
  const scope = await traineeScopeFilter(actor);

  const trainees = await prisma.user.findMany({
    where: scope,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      enrollments: {
        select: {
          course: {
            select: {
              id: true,
              stageId: true,
              modules: {
                select: { lessons: { where: { isPublished: true }, select: { id: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (trainees.length === 0) return [];

  const traineeIds = trainees.map((t) => t.id);
  const allLessonIds = [
    ...new Set(
      trainees.flatMap((t) =>
        t.enrollments.flatMap((e) =>
          e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
        ),
      ),
    ),
  ];
  const stageIds = [
    ...new Set(
      trainees.flatMap((t) =>
        t.enrollments.map((e) => e.course.stageId).filter((id): id is string => !!id),
      ),
    ),
  ];

  const [progress, approvals, certificates, stages] = await Promise.all([
    allLessonIds.length
      ? prisma.lessonProgress.findMany({
          where: {
            userId: { in: traineeIds },
            lessonId: { in: allLessonIds },
            completedAt: { not: null },
          },
          select: { userId: true, lessonId: true, completedAt: true },
        })
      : Promise.resolve([]),
    stageIds.length
      ? prisma.stageApproval.findMany({
          where: { userId: { in: traineeIds }, stageId: { in: stageIds } },
          select: { userId: true, stageId: true },
        })
      : Promise.resolve([]),
    prisma.certificate.findMany({
      where: { userId: { in: traineeIds } },
      select: { userId: true, status: true },
    }),
    stageIds.length
      ? prisma.stage.findMany({
          where: { id: { in: stageIds }, requireTrainerApproval: true },
          select: {
            id: true,
            title: true,
            courses: {
              select: {
                modules: {
                  select: { lessons: { where: { isPublished: true }, select: { id: true } } },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const completedByUser = new Map<string, Set<string>>();
  const lastActivityByUser = new Map<string, Date>();
  for (const row of progress) {
    if (!completedByUser.has(row.userId)) completedByUser.set(row.userId, new Set());
    completedByUser.get(row.userId)!.add(row.lessonId);
    if (row.completedAt) {
      const current = lastActivityByUser.get(row.userId);
      if (!current || row.completedAt > current) lastActivityByUser.set(row.userId, row.completedAt);
    }
  }

  const approvedByUser = new Map<string, Set<string>>();
  for (const row of approvals) {
    if (!approvedByUser.has(row.userId)) approvedByUser.set(row.userId, new Set());
    approvedByUser.get(row.userId)!.add(row.stageId);
  }

  const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  return trainees.map((trainee) => {
    const done = completedByUser.get(trainee.id) ?? new Set<string>();
    const approved = approvedByUser.get(trainee.id) ?? new Set<string>();

    const lessonIds = [
      ...new Set(
        trainee.enrollments.flatMap((e) =>
          e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
        ),
      ),
    ];
    const completedLessons = lessonIds.filter((id) => done.has(id)).length;
    const enrolledStageIds = new Set(
      trainee.enrollments.map((e) => e.course.stageId).filter((id): id is string => !!id),
    );

    // A stage is waiting on a trainer once its lessons are done but the
    // sign-off it requires has not been given.
    const awaitingSignOff = stages
      .filter((stage) => enrolledStageIds.has(stage.id) && !approved.has(stage.id))
      .filter((stage) => {
        const stageLessonIds = stage.courses.flatMap((c) =>
          c.modules.flatMap((m) => m.lessons.map((l) => l.id)),
        );
        return stageLessonIds.length > 0 && stageLessonIds.every((id) => done.has(id));
      })
      .map((stage) => ({ stageId: stage.id, stageTitle: stage.title }));

    const traineeCertificates = certificates.filter((c) => c.userId === trainee.id);
    const lastActivityAt = lastActivityByUser.get(trainee.id) ?? null;
    const hasWorkLeft = completedLessons < lessonIds.length;

    return {
      id: trainee.id,
      name: trainee.name,
      email: trainee.email,
      enrolledCourses: trainee.enrollments.length,
      totalLessons: lessonIds.length,
      completedLessons,
      progressPercent:
        lessonIds.length > 0 ? Math.round((completedLessons / lessonIds.length) * 100) : 0,
      awaitingSignOff,
      certificatesPending: traineeCertificates.filter((c) => c.status === "PENDING_APPROVAL").length,
      certificatesIssued: traineeCertificates.filter((c) => c.status === "ISSUED").length,
      lastActivityAt,
      isBehind:
        hasWorkLeft && lessonIds.length > 0 && (!lastActivityAt || lastActivityAt < staleCutoff),
    };
  });
}
