import Link from "next/link";
import { ClipboardCheck, ListChecks, Percent, Target, User as UserIcon, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";

/** Anyone who actually takes assessments — this codebase's learner population is TRAINEE and VA accounts, not just TRAINEE. */
const LEARNER_ROLES = ["TRAINEE", "VA"] as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function AssessmentsByQuiz() {
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

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No assessments yet"
        description="Add a knowledge check to a lesson from the Lesson Builder's Settings step."
      />
    );
  }

  return (
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
  );
}

async function AssessmentsByTrainee() {
  const learners = await prisma.user.findMany({
    where: { role: { in: [...LEARNER_ROLES] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      quizAttempts: {
        where: { submittedAt: { not: null } },
        select: { score: true, passed: true, submittedAt: true },
      },
    },
  });

  if (learners.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No trainee or VA accounts yet"
        description="Create an account from the Users page to see their assessment history here."
      />
    );
  }

  const summaries = learners.map((learner) => {
    const attempts = learner.quizAttempts;
    const attemptCount = attempts.length;
    const passCount = attempts.filter((a) => a.passed).length;
    const avgScore =
      attemptCount > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attemptCount) : null;
    const lastSubmittedAt = attempts.reduce<Date | null>((latest, a) => {
      if (!a.submittedAt) return latest;
      return !latest || a.submittedAt > latest ? a.submittedAt : latest;
    }, null);

    return {
      id: learner.id,
      name: learner.name,
      email: learner.email,
      role: learner.role,
      attemptCount,
      passRate: attemptCount > 0 ? Math.round((passCount / attemptCount) * 100) : null,
      avgScore,
      lastSubmittedAt,
    };
  });

  return (
    <div className="grid gap-2">
      {summaries.map((trainee) => (
        <Link key={trainee.id} href={`/admin/assessments/trainee/${trainee.id}`}>
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex flex-wrap items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback>{initials(trainee.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{trainee.name}</p>
                <p className="truncate text-xs text-muted-foreground">{trainee.email}</p>
              </div>
              <Badge variant="outline">{trainee.role}</Badge>
              {trainee.attemptCount === 0 ? (
                <p className="text-xs text-muted-foreground">No attempts yet</p>
              ) : (
                <>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">{trainee.avgScore}%</p>
                    <p className="text-xs text-muted-foreground">avg. score</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">{trainee.passRate}%</p>
                    <p className="text-xs text-muted-foreground">
                      {trainee.attemptCount} attempt{trainee.attemptCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    {trainee.lastSubmittedAt ? formatRelativeTime(trainee.lastSubmittedAt) : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

const TABS = [
  { key: "quiz", label: "By Assessment", icon: ClipboardCheck },
  { key: "trainee", label: "By Trainee", icon: UserIcon },
] as const;

export default async function AdminAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const activeTab: (typeof TABS)[number]["key"] = view === "trainee" ? "trainee" : "quiz";

  const [quizAggregate, learnerAggregate] = await Promise.all([
    prisma.quiz.findMany({ select: { attempts: { select: { passed: true, score: true } } } }),
    prisma.user.count({ where: { role: { in: [...LEARNER_ROLES] } } }),
  ]);
  const allAttempts = quizAggregate.flatMap((q) => q.attempts);
  const totalAttempts = allAttempts.length;
  const overallPassRate =
    totalAttempts > 0
      ? Math.round((allAttempts.filter((a) => a.passed).length / totalAttempts) * 100)
      : 0;
  const totalQuizzes = quizAggregate.length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Assessments</h1>
        <p className="text-muted-foreground">
          Every knowledge check across your programs, with real attempt and pass-rate data —
          browsed by assessment, or by trainee to see how one person is doing across all of them.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total assessments" value={totalQuizzes} icon={ClipboardCheck} />
        <StatCard label="Total attempts" value={totalAttempts} icon={ListChecks} />
        <StatCard label="Avg. pass rate" value={`${overallPassRate}%`} icon={Percent} tone="success" />
        <StatCard label="Trainees & VAs" value={learnerAggregate} icon={Users} />
      </div>

      <div className="flex w-fit gap-1 rounded-lg border bg-muted/40 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "quiz" ? "/admin/assessments" : "/admin/assessments?view=trainee"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "quiz" ? <AssessmentsByQuiz /> : <AssessmentsByTrainee />}
    </div>
  );
}
