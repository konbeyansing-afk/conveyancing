import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuizAttemptDetail } from "@/components/assessments/quiz-attempt-detail";

export default async function QuizAttemptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string; attemptId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { quizId, attemptId } = await params;
  const { from } = await searchParams;

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { id: true, name: true, email: true } },
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

  if (!attempt || attempt.quizId !== quizId) notFound();

  // Reached from a trainee's own profile: go straight back there rather than
  // the flat per-quiz roster, which isn't where the admin came from.
  const cameFromTrainee = from === attempt.user.id;

  return (
    <QuizAttemptDetail
      attempt={attempt}
      backHref={cameFromTrainee ? `/admin/assessments/trainee/${from}` : `/admin/assessments/${quizId}`}
      backLabel={cameFromTrainee ? attempt.user.name : attempt.quiz.title}
    />
  );
}
