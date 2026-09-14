import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { lessonContentToHtml } from "@/components/lesson-content/lesson-content-html";
import { InteractiveLessonViewer } from "@/components/lesson-content/interactive-lesson-viewer";
import { splitIntoSteps } from "@/lib/tiptap/split-into-steps";
import { markLessonComplete } from "@/lib/actions/progress";
import { submitTraineeSignOff } from "@/lib/actions/lesson-signoff";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished } from "@/lib/stage-access";
import { matterFontVariables } from "@/lib/fonts";
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
      module: { include: { course: { include: { program: true, stage: { include: { program: true } } } } } },
      quiz: { select: { id: true } },
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

  const signOffRow = lesson.requiresSignOff && userId
    ? await prisma.lessonSignOff.findUnique({
        where: { lessonId_userId: { lessonId: lesson.id, userId } },
        select: { traineeName: true, traineeSignedAt: true, trainerName: true, trainerResult: true, trainerSignedAt: true },
      })
    : null;

  return (
    <div className={matterFontVariables}>
      <InteractiveLessonViewer
        steps={steps}
        lessonTitle={lesson.title}
        moduleTitle={lesson.module.title}
        backHref={`/app/courses/${course.id}`}
        backLabel={course.title}
        onComplete={completeAction}
        quizHref={lesson.quiz ? `/app/courses/${course.id}/lessons/${lesson.id}/quiz` : undefined}
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
      />
    </div>
  );
}
