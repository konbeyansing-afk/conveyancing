import { Award, CheckCircle2, PlayCircle, Route } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StatTile } from "@/components/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
  getJourneyForUser,
  getNextLessonHrefForStage,
  getPrimaryProgramForUser,
} from "@/lib/stage-access";
import { JourneySummaryCard } from "@/components/trainee/journey-summary-card";

export default async function TraineeDashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const firstName = (session!.user.name ?? "there").split(" ")[0];

  const [program, recentCompletions, recentQuizAttempts, certificateCounts] = await Promise.all([
    getPrimaryProgramForUser(userId),
    prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 5,
      include: { lesson: { select: { title: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 5,
      include: { quiz: { select: { title: true } } },
    }),
    prisma.certificate.groupBy({ by: ["status"], where: { userId }, _count: true }),
  ]);

  const issuedCertificates =
    certificateCounts.find((c) => c.status === "ISSUED")?._count ?? 0;
  const pendingCertificates =
    certificateCounts.find((c) => c.status === "PENDING_APPROVAL")?._count ?? 0;

  const stages = program ? await getJourneyForUser(program.id, userId) : [];
  const currentStage = stages.find((s) => s.status === "current");
  const continueHref = currentStage ? await getNextLessonHrefForStage(currentStage.id, userId) : null;

  const completedStages = stages.filter((s) => s.status === "completed").length;
  const overallPercent = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;

  type Activity = { key: string; timestamp: Date; message: string; dot: string };
  const activity: Activity[] = [
    ...recentCompletions.map((p) => ({
      key: `complete-${p.lessonId}`,
      timestamp: p.completedAt!,
      message: `Completed ${p.lesson.title}`,
      dot: "bg-emerald-500",
    })),
    ...recentQuizAttempts.map((a) => ({
      key: `quiz-${a.id}`,
      timestamp: a.submittedAt!,
      message: `Scored ${a.score}% on ${a.quiz.title}`,
      dot: a.passed ? "bg-emerald-500" : "bg-amber-500",
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 6);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-balance">Welcome back, {firstName}</h1>
        <p className="text-muted-foreground">
          Track your training, continue your lessons, and monitor your progress.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={CheckCircle2}
          value={completedStages}
          label="Stages Completed"
          hint={`of ${stages.length}`}
          tone="success"
        />
        <StatTile
          icon={PlayCircle}
          value={currentStage ? `Stage ${currentStage.order + 1}` : "—"}
          label="Current Stage"
          hint={currentStage?.title}
          tone="primary"
        />
        <StatTile
          icon={Route}
          value={`${overallPercent}%`}
          label="Overall Progress"
          hint="Across all stages"
          tone="warning"
        />
        <StatTile
          icon={Award}
          value={issuedCertificates}
          label="Certificates"
          hint={
            pendingCertificates > 0
              ? `${pendingCertificates} awaiting sign-off`
              : issuedCertificates > 0
                ? "Earned"
                : "Finish a program to earn one"
          }
        />
      </div>

      {stages.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No training journey yet"
          description="Your guided training pathway will appear here once it's been set up."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <JourneySummaryCard programTitle={program!.title} stages={stages} continueHref={continueHref} />

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing yet — your completed lessons and quiz results will show up here.
                </p>
              ) : (
                <ul className="grid gap-4">
                  {activity.map((item) => (
                    <li key={item.key} className="flex gap-2.5 text-sm">
                      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.dot}`} />
                      <div>
                        <p>{item.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.timestamp)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
