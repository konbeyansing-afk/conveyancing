import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, ListChecks, Percent, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";

/**
 * Every assessment one trainee (or VA — see LEARNER_ROLES in the parent
 * page) has taken, most recent first. Each attempt links straight into the
 * existing per-question breakdown at
 * /admin/assessments/[quizId]/attempts/[attemptId] — this page is purely a
 * by-person entry point onto that already-built detail view, not a
 * duplicate of it.
 */
export default async function TraineeAssessmentsPage({
  params,
}: {
  params: Promise<{ traineeId: string }>;
}) {
  const { traineeId } = await params;

  const trainee = await prisma.user.findUnique({
    where: { id: traineeId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      quizAttempts: {
        orderBy: { submittedAt: "desc" },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              passingScore: true,
              course: {
                select: { title: true, program: { select: { title: true } }, stage: { select: { title: true } } },
              },
              lesson: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  if (!trainee || (trainee.role !== "TRAINEE" && trainee.role !== "VA")) notFound();

  const attempts = trainee.quizAttempts;
  const submitted = attempts.filter((a) => a.submittedAt);
  const passCount = submitted.filter((a) => a.passed).length;
  const passRate = submitted.length > 0 ? Math.round((passCount / submitted.length) * 100) : null;
  const avgScore =
    submitted.length > 0
      ? Math.round(submitted.reduce((s, a) => s + a.score, 0) / submitted.length)
      : null;
  const distinctQuizzes = new Set(attempts.map((a) => a.quizId)).size;

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin/assessments?view=trainee"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" /> Assessments
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{trainee.name}</h1>
          <Badge variant="outline">{trainee.role}</Badge>
        </div>
        <p className="text-muted-foreground">{trainee.email}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Assessments taken" value={distinctQuizzes} icon={ClipboardCheck} />
        <StatCard label="Total attempts" value={attempts.length} icon={ListChecks} />
        <StatCard label="Avg. score" value={avgScore !== null ? `${avgScore}%` : "—"} icon={Percent} />
        <StatCard
          label="Pass rate"
          value={passRate !== null ? `${passRate}%` : "—"}
          icon={Target}
          tone="success"
        />
      </div>

      {attempts.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attempts yet"
          description="Results will show up here once this person takes a knowledge check."
        />
      ) : (
        <div className="grid gap-2">
          {attempts.map((attempt) => (
            <Link
              key={attempt.id}
              href={`/admin/assessments/${attempt.quizId}/attempts/${attempt.id}`}
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ClipboardCheck className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{attempt.quiz.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {attempt.quiz.course.stage
                        ? attempt.quiz.course.stage.title
                        : attempt.quiz.course.program.title}{" "}
                      › {attempt.quiz.course.title}
                      {attempt.quiz.lesson ? ` › ${attempt.quiz.lesson.title}` : ""}
                    </p>
                  </div>
                  <Badge variant={attempt.passed ? "default" : "destructive"}>
                    {attempt.passed ? "Passed" : "Failed"}
                  </Badge>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">{attempt.score}%</p>
                    <p className="text-xs text-muted-foreground">
                      {attempt.submittedAt ? formatRelativeTime(attempt.submittedAt) : "In progress"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
