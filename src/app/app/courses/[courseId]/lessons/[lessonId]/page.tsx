import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { lessonContentToHtml } from "@/components/lesson-content/lesson-content-html";
import { InteractiveLessonViewer } from "@/components/lesson-content/interactive-lesson-viewer";
import { splitIntoSteps } from "@/lib/tiptap/split-into-steps";
import { findNextLesson } from "@/lib/next-lesson";
import { markLessonComplete } from "@/lib/actions/progress";
import { submitTraineeSignOff } from "@/lib/actions/lesson-signoff";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished } from "@/lib/stage-access";
import type { JSONContent } from "@tiptap/core";

export default async function TraineeLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: {
          course: {
            include: {
              program: true,
              stage: { include: { program: true } },
              modules: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  order: true,
                  lessons: { select: { id: true, order: true, isPublished: true } },
                },
              },
            },
          },
        },
      },
      quiz: {
        select: { id: true, title: true, passingScore: true, _count: { select: { questions: true } } },
      },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });

  const course = lesson?.module.course;
  const isPublished = course && isCoursePublished(course) && lesson?.isPublished;
  const session = await auth();
  const userId = session?.user?.id;
  const stageUnlocked =
    course && course.stage && userId ? await isStageUnlockedForUser(course.stage.id, userId) : true;
  const allowed =
    course &&
    ((await canPreviewUnpublished()) ||
      (isPublished && (await isEnrolledInCourse(course.id)) && stageUnlocked));

  if (!lesson || !course || course.id !== courseId || !allowed) {
    notFound();
  }

  const rawSteps = splitIntoSteps(lesson.content as JSONContent | null);
  const steps = rawSteps.length > 0
    ? rawSteps.map((s) => ({ title: s.title, html: lessonContentToHtml(s.content) }))
    : [{ title: lesson.title, html: "<p>This lesson doesn&apos;t have content yet.</p>" }];

  const completeAction = markLessonComplete.bind(null, lesson.id);
  const signOffAction = submitTraineeSignOff.bind(null, lesson.id);

  const [signOffRow, progressRow] = await Promise.all([
    lesson.requiresSignOff && userId
      ? prisma.lessonSignOff.findUnique({
          where: { lessonId_userId: { lessonId: lesson.id, userId } },
          select: { traineeName: true, traineeSignedAt: true, trainerName: true, trainerResult: true, trainerSignedAt: true },
        })
      : Promise.resolve(null),
    userId
      ? prisma.lessonProgress.findUnique({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
          select: { completedAt: true },
        })
      : Promise.resolve(null),
  ]);

  const next = findNextLesson(course.modules, lesson.module.id, lesson.id);
  const nextLesson = next ? await prisma.lesson.findUnique({ where: { id: next.lessonId }, select: { title: true } }) : null;

  const jurisdiction = course.program.jurisdiction ?? course.stage?.program.jurisdiction ?? null;

  return (
    <InteractiveLessonViewer
      steps={steps}
      lessonTitle={lesson.title}
      moduleTitle={lesson.module.title}
      backHref={`/app/courses/${course.id}`}
      backLabel={course.title}
      onComplete={completeAction}
      quizHref={lesson.quiz ? `/app/courses/${course.id}/lessons/${lesson.id}/quiz` : undefined}
      quizMeta={
        lesson.quiz
          ? { title: lesson.quiz.title, questionCount: lesson.quiz._count.questions, passingScore: lesson.quiz.passingScore }
          : undefined
      }
      isDraftPreview={!isPublished}
      resources={lesson.attachments}
      requiresSignOff={lesson.requiresSignOff}
      signOff={
        signOffRow
          ? {
              traineeName: signOffRow.traineeName,
              traineeSignedAt: signOffRow.traineeSignedAt?.toISOString() ?? null,
              trainerName: signOffRow.trainerName,
              trainerResult: signOffRow.trainerResult,
              trainerSignedAt: signOffRow.trainerSignedAt?.toISOString() ?? null,
            }
          : null
      }
      onSubmitSignOff={signOffAction}
      jurisdiction={jurisdiction}
      stageTitle={course.stage?.title ?? null}
      estimatedMinutes={lesson.estimatedMinutes}
      progressState={progressRow?.completedAt ? "completed" : "not_started"}
      nextLessonHref={next ? `/app/courses/${course.id}/lessons/${next.lessonId}` : null}
      nextLessonTitle={nextLesson?.title ?? null}
    />
  );
}
