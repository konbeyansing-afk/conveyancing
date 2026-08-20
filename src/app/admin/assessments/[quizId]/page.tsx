import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, ListChecks, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/format-relative-time";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function QuizAttemptsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
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
      lesson: { select: { title: true } },
      questions: { select: { id: true } },
      attempts: {
        orderBy: { submittedAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!quiz) notFound();

  const passCount = quiz.attempts.filter((a) => a.passed).length;
  const passRate =
    quiz.attempts.length > 0 ? Math.round((passCount / quiz.attempts.length) * 100) : null;

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin/assessments"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" /> Assessments
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{quiz.title}</h1>
        <p className="text-muted-foreground">
          {quiz.course.stage ? quiz.course.stage.title : quiz.course.program.title} › {quiz.course.title}
          {quiz.lesson ? ` › ${quiz.lesson.title}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Questions" value={quiz.questions.length} icon={ClipboardCheck} />
        <StatCard label="Attempts" value={quiz.attempts.length} icon={ListChecks} />
        <StatCard
          label="Pass rate"
          value={passRate !== null ? `${passRate}%` : "—"}
          icon={Target}
          tone="success"
        />
      </div>

      {quiz.attempts.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attempts yet"
          description="Results will show up here once a trainee takes this knowledge check."
        />
      ) : (
        <div className="grid gap-2">
          {quiz.attempts.map((attempt) => (
            <Link key={attempt.id} href={`/admin/assessments/${quiz.id}/attempts/${attempt.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(attempt.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{attempt.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{attempt.user.email}</p>
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
