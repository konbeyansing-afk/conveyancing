import { Award, CheckCircle2, ClipboardCheck, Route } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StatTile } from "@/components/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { getContinueLearningInfo, getJourneyForUser, getPrimaryProgramForUser } from "@/lib/stage-access";
import { ContinueLearningCard } from "@/components/trainee/continue-learning-card";
import { ProgramProgressCard } from "@/components/trainee/program-progress-card";
import { DashboardHero } from "@/components/trainee/dashboard-hero";

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
    // Scoped to the "Certificates" stat tile, which is deliberately a
    // program-agnostic total — a trainee could have finished more than one.
    prisma.certificate.groupBy({ by: ["status"], where: { userId }, _count: true }),
  ]);

  const issuedCertificates = certificateCounts.find((c) => c.status === "ISSUED")?._count ?? 0;
  const pendingCertificates =
    certificateCounts.find((c) => c.status === "PENDING_APPROVAL")?._count ?? 0;

  const [stages, primaryCertificate] = await Promise.all([
    program ? getJourneyForUser(program.id, userId) : Promise.resolve([]),
    program
      ? prisma.certificate.findUnique({
          where: { userId_programId: { userId, programId: program.id } },
          select: { status: true },
        })
      : Promise.resolve(null),
  ]);

  const currentStage = stages.find((s) => s.status === "current");
  const { target: continueTarget, upcomingAssessment } = currentStage
    ? await getContinueLearningInfo(currentStage.id, userId)
    : { target: null, upcomingAssessment: null };

  const completedStages = stages.filter((s) => s.status === "completed").length;
  const lockedStageCount = stages.filter((s) => s.status === "locked").length;
  const allStagesComplete = stages.length > 0 && completedStages === stages.length;
  const overallPercent = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;

  const totalLessons = stages.reduce((sum, s) => sum + s.totalLessons, 0);
  const completedLessons = stages.reduce((sum, s) => sum + s.completedLessons, 0);

  const nextMilestone = allStagesComplete
    ? primaryCertificate?.status === "ISSUED"
      ? "Program complete — certificate issued"
      : "Program complete — certificate awaiting sign-off"
    : currentStage
      ? `Complete "${currentStage.title}"`
      : lockedStageCount > 0
        ? "Waiting on a prerequisite stage"
        : null;

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
      <DashboardHero
        firstName={firstName}
        programTitle={program?.title ?? null}
        jurisdiction={program?.jurisdiction}
        stageNumber={currentStage ? currentStage.order + 1 : null}
        stageTitle={currentStage?.title ?? null}
        lessonTitle={continueTarget?.lesson.title ?? null}
        continueHref={continueTarget?.href ?? null}
        percent={totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0}
        completedLessons={completedLessons}
        totalLessons={totalLessons}
      />

      {stages.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No training journey yet"
          description="Your guided training pathway will appear here once it's been set up."
        />
      ) : (
        <>
          {(!continueTarget || allStagesComplete) && (
            <ContinueLearningCard
              stageTitle={currentStage?.title ?? null}
              stageHasPublishedLessons={(currentStage?.totalLessons ?? 0) > 0}
              target={continueTarget}
              upcomingAssessment={upcomingAssessment}
              allStagesComplete={allStagesComplete}
              certificateStatus={primaryCertificate?.status ?? null}
            />
          )}
          {continueTarget && upcomingAssessment && !allStagesComplete && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardCheck className="size-4 shrink-0" />
              Assessment coming up: <span className="font-medium text-foreground">{upcomingAssessment.quizTitle}</span> ({upcomingAssessment.lessonTitle})
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={CheckCircle2}
              value={completedStages}
              label="Stages Completed"
              hint={`of ${stages.length}`}
              tone="success"
            />
            <StatTile
              icon={Route}
              value={`${overallPercent}%`}
              label="Stage Progress"
              hint="Across all stages"
              tone="primary"
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

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <ProgramProgressCard
              completedLessons={completedLessons}
              totalLessons={totalLessons}
              nextMilestone={nextMilestone}
              lockedStageCount={lockedStageCount}
            />

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
        </>
      )}
    </div>
  );
}
