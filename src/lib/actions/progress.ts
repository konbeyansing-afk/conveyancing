"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished, isStageComplete } from "@/lib/stage-access";
import { syncCompletionForLesson } from "@/lib/completion";
import { maybeCreateCertificate } from "@/lib/certificates";

export type MarkLessonCompleteResult = {
  ok: boolean;
  reason?: "quiz_required" | "stage_locked" | "signoff_required";
  stageJustCompleted?: { id: string; title: string };
  /** Milestones this completion unlocked, in hierarchy order. */
  newlyCompleted?: { scope: string; id: string; title: string }[];
  programJustCompleted?: { id: string; title: string } | null;
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
      requiresSignOff: true,
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

  // Independent of the quiz gate, and independent of any trainer review of
  // it — a trainee's own completion depends only on their own attestation,
  // never on whether a trainer has since reviewed it (see
  // src/lib/actions/lesson-signoff.ts).
  if (lesson.requiresSignOff) {
    const signOff = await prisma.lessonSignOff.findUnique({
      where: { lessonId_userId: { lessonId, userId } },
      select: { traineeSignedAt: true },
    });
    if (!signOff?.traineeSignedAt) return { ok: false, reason: "signoff_required" };
  }

  const wasStageComplete = course.stage ? await isStageComplete(course.stage.id, userId) : false;

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completedAt: new Date() },
    create: { userId, lessonId, completedAt: new Date() },
  });

  // Milestones are recorded from what is now actually true, never from the fact
  // that this action was reached.
  const sync = await syncCompletionForLesson(lessonId, userId);

  // Finishing the program puts a certificate in front of a trainer for
  // sign-off. It is never issued automatically.
  if (sync.programCompleted) {
    await maybeCreateCertificate(userId, sync.programCompleted.id);
  }

  if (course.stage && !wasStageComplete && (await isStageComplete(course.stage.id, userId))) {
    return {
      ok: true,
      stageJustCompleted: { id: course.stage.id, title: course.stage.title },
      newlyCompleted: sync.newlyCompleted,
      programJustCompleted: sync.programCompleted,
    };
  }
  return {
    ok: true,
    newlyCompleted: sync.newlyCompleted,
    programJustCompleted: sync.programCompleted,
  };
}
