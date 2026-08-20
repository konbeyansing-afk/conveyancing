import Link from "next/link";
import { ClipboardCheck, ListChecks, Percent, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminAssessmentsPage() {
  const quizzes = await prisma.quiz.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          programId: true,
          program: { select: { title: true } },
          stage: { select: { title: true } },
        },
      },
      lesson: { select: { id: true, title: true, moduleId: true } },
      questions: { select: { id: true } },
      attempts: { select: { passed: true, score: true } },
    },
  });

  const summaries = quizzes.map((quiz) => {
    const attemptCount = quiz.attempts.length;
    const passCount = quiz.attempts.filter((a) => a.passed).length;
    const avgScore =
      attemptCount > 0
        ? Math.round(quiz.attempts.reduce((s, a) => s + a.score, 0) / attemptCount)
        : null;
    return {
      id: quiz.id,
      title: quiz.title,
      programTitle: quiz.course.stage ? quiz.course.stage.title : quiz.course.program.title,
      courseTitle: quiz.course.title,
      lessonTitle: quiz.lesson?.title ?? null,
      questionCount: quiz.questions.length,
      passingScore: quiz.passingScore,
      attemptCount,
      passRate: attemptCount > 0 ? Math.round((passCount / attemptCount) * 100) : null,
      avgScore,
      resultsHref: `/admin/assessments/${quiz.id}`,
    };
  });

  const totalAttempts = summaries.reduce((s, q) => s + q.attemptCount, 0);
  const ratedQuizzes = summaries.filter((q) => q.passRate !== null);
  const overallPassRate =
    ratedQuizzes.length > 0
      ? Math.round(ratedQuizzes.reduce((s, q) => s + (q.passRate ?? 0), 0) / ratedQuizzes.length)
      : 0;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Assessments</h1>
        <p className="text-muted-foreground">
          Every knowledge check across your programs, with real attempt and pass-rate data.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total assessments" value={summaries.length} icon={ClipboardCheck} />
        <StatCard label="Total attempts" value={totalAttempts} icon={ListChecks} />
        <StatCard label="Avg. pass rate" value={`${overallPassRate}%`} icon={Percent} tone="success" />
      </div>

      {summaries.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No assessments yet"
          description="Add a knowledge check to a lesson from the Lesson Builder's Settings step."
        />
      ) : (
        <div className="grid gap-2">
          {summaries.map((quiz) => (
            <Link key={quiz.id} href={quiz.resultsHref}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ClipboardCheck className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{quiz.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {quiz.programTitle} › {quiz.courseTitle}
                      {quiz.lessonTitle ? ` › ${quiz.lessonTitle}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline">Pass ≥ {quiz.passingScore}%</Badge>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">
                      {quiz.passRate !== null ? `${quiz.passRate}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {quiz.attemptCount} attempt{quiz.attemptCount === 1 ? "" : "s"}
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
