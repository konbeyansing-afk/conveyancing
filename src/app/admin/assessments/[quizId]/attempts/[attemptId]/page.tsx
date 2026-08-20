import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";

type SubmittedAnswer = { choiceId?: string; text?: string; correct?: boolean };

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

  const answers = attempt.answers as Record<string, SubmittedAnswer>;

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href={`/admin/assessments/${quizId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" /> {attempt.quiz.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{attempt.user.name}</h1>
            <p className="text-muted-foreground">
              {attempt.quiz.course.stage ? attempt.quiz.course.stage.title : attempt.quiz.course.program.title} ›{" "}
              {attempt.quiz.course.title}
              {attempt.quiz.lesson ? ` › ${attempt.quiz.lesson.title}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {attempt.submittedAt
                ? `Submitted ${formatRelativeTime(attempt.submittedAt)}`
                : "In progress"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums">{attempt.score}%</p>
            <Badge variant={attempt.passed ? "default" : "destructive"}>
              {attempt.passed ? "Passed" : "Failed"} · needed {attempt.quiz.passingScore}%
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {attempt.quiz.questions.map((q, i) => {
          const ans = answers?.[q.id];

          if (q.type === "SHORT_ANSWER") {
            return (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-normal">
                    {i + 1}. {q.prompt}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <p className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                    {ans?.text ? (
                      ans.text
                    ) : (
                      <span className="text-muted-foreground italic">No answer given</span>
                    )}
                  </p>
                  {q.explanation && (
                    <p className="text-xs text-muted-foreground">{q.explanation}</p>
                  )}
                </CardContent>
              </Card>
            );
          }

          const chosen = q.choices.find((c) => c.id === ans?.choiceId);
          const correctChoice = q.choices.find((c) => c.isCorrect);
          const isCorrect = !!chosen?.isCorrect;

          return (
            <Card key={q.id}>
              <CardHeader className="flex-row items-start gap-2">
                {isCorrect ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <CardTitle className="text-sm font-normal">
                    {i + 1}. {q.prompt}
                  </CardTitle>
                  <p className="mt-1 text-sm">
                    Answered:{" "}
                    {chosen ? (
                      chosen.text
                    ) : (
                      <span className="text-muted-foreground italic">No answer given</span>
                    )}
                  </p>
                  {!isCorrect && correctChoice && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Correct answer: {correctChoice.text}
                    </p>
                  )}
                  {q.explanation && (
                    <p className="mt-1 text-xs text-muted-foreground">{q.explanation}</p>
                  )}
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
