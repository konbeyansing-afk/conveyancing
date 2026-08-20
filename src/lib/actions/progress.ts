"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished, isStageComplete } from "@/lib/stage-access";

export type MarkLessonCompleteResult = {
  ok: boolean;
  reason?: "quiz_required" | "stage_locked";
  stageJustCompleted?: { id: string; title: string };
};

export async function markLessonComplete(lessonId: string): Promise<MarkLessonCompleteResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false };

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isPublished: true,
      completionRequirement: true,
      quiz: { select: { id: true } },
      module: {
        select: {
          course: {
            select: {
              id: true,
              isPublished: true,
              program: { select: { isPublished: true } },
              stage: {
                select: { id: true, title: true, isPublished: true, program: { select: { isPublished: true } } },
              },
            },
          },
        },
      },
    },
  });
  const course = lesson?.module.course;
  if (!course) return { ok: false };

  const isPublished = lesson.isPublished && isCoursePublished(course);
  const staffPreview = await canPreviewUnpublished();

  if (!staffPreview) {
    if (!isPublished || !(await isEnrolledInCourse(course.id))) return { ok: false };
    // Critical mutation-level gate: this stops a locked-stage lesson from being marked
    // complete server-side even if a trainee somehow reaches this action directly.
    if (course.stage && !(await isStageUnlockedForUser(course.stage.id, userId))) {
      return { ok: false, reason: "stage_locked" };
    }
  }

  if (lesson.completionRequirement === "PASS_QUIZ" && lesson.quiz) {
    const passed = await prisma.quizAttempt.findFirst({
      where: { quizId: lesson.quiz.id, userId, passed: true },
      select: { id: true },
    });
    if (!passed) return { ok: false, reason: "quiz_required" };
  }

  const wasStageComplete = course.stage ? await isStageComplete(course.stage.id, userId) : false;

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completedAt: new Date() },
    create: { userId, lessonId, completedAt: new Date() },
  });

  if (course.stage && !wasStageComplete && (await isStageComplete(course.stage.id, userId))) {
    return { ok: true, stageJustCompleted: { id: course.stage.id, title: course.stage.title } };
  }
  return { ok: true };
}
