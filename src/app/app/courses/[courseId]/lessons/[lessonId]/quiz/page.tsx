import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { QuizAttemptForm } from "@/components/lesson-content/quiz-attempt-form";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished } from "@/lib/stage-access";
import { matterFontVariables } from "@/lib/fonts";

export default async function TraineeQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: { include: { program: true, stage: { include: { program: true } } } } } },
      quiz: { include: { questions: { orderBy: { order: "asc" }, include: { choices: { orderBy: { order: "asc" } } } } } },
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

  if (!lesson || !lesson.quiz || !course || course.id !== courseId || !allowed) {
    notFound();
  }

  // Never send `isCorrect` to the client — that would leak the answer key in the page payload.
  const questions = lesson.quiz.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
  }));

  return (
    <div className={matterFontVariables}>
      <QuizAttemptForm
        quizId={lesson.quiz.id}
        quizTitle={lesson.quiz.title}
        passingScore={lesson.quiz.passingScore}
        questions={questions}
        courseId={course.id}
      />
    </div>
  );
}
