import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findScopedTrainee } from "@/lib/trainer-scope";
import { lessonContentToHtml } from "@/components/lesson-content/lesson-content-html";
import { TrainerSignOffForm } from "@/components/trainer/trainer-sign-off-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { JSONContent } from "@tiptap/core";

const shortDateTime = (date: Date) =>
  date.toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The route that did not exist before this feature: a Trainer opening one
 * specific trainee's rendered lesson content, to record their own
 * (independent, non-gating) sign-off review on it. Read-only — this is
 * review, not the trainee's own interactive step-by-step experience.
 *
 * Access goes through findScopedTrainee, same as /trainer/trainees/[traineeId]
 * — a 404 for a trainee not assigned to this trainer, not a "forbidden".
 */
export default async function TrainerTraineeLessonPage({
  params,
}: {
  params: Promise<{ traineeId: string; courseId: string; lessonId: string }>;
}) {
  const { traineeId, courseId, lessonId } = await params;
  const session = await auth();
  const actor = { id: session!.user.id, role: session!.user.role };

  const trainee = await findScopedTrainee(actor, traineeId);
  if (!trainee) notFound();

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } }, quiz: { select: { id: true, title: true, passingScore: true } } },
  });
  const course = lesson?.module.course;
  if (!lesson || !course || course.id !== courseId) notFound();

  const [progress, quizAttempt, signOff] = await Promise.all([
    prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: trainee.id, lessonId } },
      select: { completedAt: true },
    }),
    lesson.quiz
      ? prisma.quizAttempt.findFirst({
          where: { quizId: lesson.quiz.id, userId: trainee.id, passed: true },
          orderBy: { submittedAt: "desc" },
        })
      : null,
    prisma.lessonSignOff.findUnique({ where: { lessonId_userId: { lessonId, userId: trainee.id } } }),
  ]);

  const html = lessonContentToHtml(lesson.content as JSONContent | null);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Trainees", href: "/trainer/trainees" },
          { label: trainee.name, href: `/trainer/trainees/${trainee.id}` },
          { label: lesson.title },
        ]}
        title={lesson.title}
        description={`${course.title} — reviewing for ${trainee.name}`}
      />

      <Card>
        <CardContent className="grid gap-2 pt-6 text-sm">
          <div className="flex items-center gap-2">
            {progress?.completedAt ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <Circle className="size-4 text-muted-foreground" />
            )}
            {progress?.completedAt ? `Completed ${shortDateTime(progress.completedAt)}` : "Not yet completed"}
          </div>
          {lesson.quiz && (
            <div className="flex items-center gap-2">
              {quizAttempt ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
              {quizAttempt
                ? `Passed "${lesson.quiz.title}" — ${quizAttempt.score}%`
                : `Has not yet passed "${lesson.quiz.title}"`}
            </div>
          )}
          {lesson.requiresSignOff && (
            <div className="flex items-center gap-2">
              {signOff?.traineeSignedAt ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
              {signOff?.traineeSignedAt
                ? `Signed by ${signOff.traineeName} on ${shortDateTime(signOff.traineeSignedAt)}`
                : "Has not yet signed off"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="lesson-content pt-6" dangerouslySetInnerHTML={{ __html: html }} />
      </Card>

      {lesson.requiresSignOff ? (
        <TrainerSignOffForm
          lessonId={lesson.id}
          traineeId={trainee.id}
          existing={
            signOff
              ? { trainerName: signOff.trainerName, trainerResult: signOff.trainerResult, trainerNotes: signOff.trainerNotes }
              : null
          }
        />
      ) : (
        <p className="text-sm text-muted-foreground">This lesson does not require a sign-off.</p>
      )}
    </div>
  );
}
