import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuizAttemptDetail } from "@/components/assessments/quiz-attempt-detail";

export default async function QuizAttemptDetailPage({
  params,
}: {
  params: Promise<{ quizId: string; attemptId: string }>;
}) {
  const { quizId, attemptId } = await params;

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

  if (!attempt || attempt.quizId !== quizId) notFound();

  return <QuizAttemptDetail attempt={attempt} backHref={`/admin/assessments/${quizId}`} backLabel={attempt.quiz.title} />;
}
