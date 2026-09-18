import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findScopedTrainee } from "@/lib/trainer-scope";
import { QuizAttemptDetail } from "@/components/assessments/quiz-attempt-detail";

/**
 * The same question-by-question breakdown the admin assessments area shows,
 * scoped to trainers: findScopedTrainee 404s for a trainee this trainer isn't
 * assigned to, and the attempt is additionally checked against that trainee's
 * own id so a trainer can't view another trainee's attempt by guessing an id.
 */
export default async function TrainerQuizAttemptDetailPage({
  params,
}: {
  params: Promise<{ traineeId: string; attemptId: string }>;
}) {
  const { traineeId, attemptId } = await params;
  const session = await auth();
  const actor = { id: session!.user.id, role: session!.user.role };

  const trainee = await findScopedTrainee(actor, traineeId);
  if (!trainee) notFound();

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { name: true, email: true } },
      quiz: {
        include: {
          course: {
            select: { title: true, program: { select: { title: true } }, stage: { select: { title: true } } },
          },
          lesson: { select: { title: true } },
          questions: {
            orderBy: { order: "asc" },
            include: { choices: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== trainee.id) notFound();

  return (
    <QuizAttemptDetail attempt={attempt} backHref={`/trainer/trainees/${trainee.id}`} backLabel={trainee.name} />
  );
}
