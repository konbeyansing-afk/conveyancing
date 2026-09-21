import { AlertTriangle, CheckCircle2, TrendingUp, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getJourneyForUser, getPrimaryProgramForUser } from "@/lib/stage-access";
import {
  computeNeedsAttentionReasons,
  computeOverallAssessmentStatus,
  computeTrainingStatus,
  summarizeAttempts,
  type AttemptLike,
} from "@/lib/assessment-dashboard";
import { StatCard } from "@/components/admin/stat-card";
import { TraineeAssessmentRoster, type TraineeRosterRow } from "@/components/admin/trainee-assessment-roster";

/** Anyone who actually takes assessments — this codebase's learner population is TRAINEE and VA accounts, not just TRAINEE. */
const LEARNER_ROLES = ["TRAINEE", "VA"] as const;

export default async function AdminAssessmentsPage() {
  const [learners, programs] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [...LEARNER_ROLES] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        enrollments: { select: { id: true } },
        quizAttempts: {
          select: {
            quizId: true,
            score: true,
            passed: true,
            submittedAt: true,
            quiz: {
              select: { title: true, course: { select: { title: true } }, lesson: { select: { title: true } } },
            },
          },
        },
        lessonProgress: { where: { completedAt: { not: null } }, select: { completedAt: true } },
      },
    }),
    prisma.program.findMany({ select: { id: true, jurisdiction: true } }),
  ]);

  const jurisdictionByProgramId = new Map(programs.map((p) => [p.id, p.jurisdiction]));

  const rows: TraineeRosterRow[] = await Promise.all(
    learners.map(async (learner) => {
      const attempts: AttemptLike[] = learner.quizAttempts.map((a) => ({
        quizId: a.quizId,
        quizTitle: a.quiz.title,
        score: a.score,
        passed: a.passed,
        submittedAt: a.submittedAt,
        context: a.quiz.lesson ? `${a.quiz.course.title} — ${a.quiz.lesson.title}` : a.quiz.course.title,
      }));

      const program = await getPrimaryProgramForUser(learner.id);
      const journey = program ? await getJourneyForUser(program.id, learner.id) : [];
      const totalLessons = journey.reduce((n, s) => n + s.totalLessons, 0);
      const completedLessons = journey.reduce((n, s) => n + s.completedLessons, 0);
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const lastActivityAt = [
        ...learner.lessonProgress.map((l) => l.completedAt!),
        ...attempts.filter((a): a is AttemptLike & { submittedAt: Date } => !!a.submittedAt).map((a) => a.submittedAt),
      ].sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      const needsAttentionReasons = computeNeedsAttentionReasons({ attempts, lastActivityAt });
      const trainingStatus = computeTrainingStatus({
        isEnrolled: learner.enrollments.length > 0,
        progressPercent,
        needsAttention: needsAttentionReasons.length > 0,
      });
      const assessmentStatus = computeOverallAssessmentStatus(attempts);
      const summary = summarizeAttempts(attempts);

      return {
        id: learner.id,
        name: learner.name,
        email: learner.email,
        role: learner.role as "TRAINEE" | "VA",
        jurisdiction: program ? (jurisdictionByProgramId.get(program.id) ?? null) : null,
        programTitle: program?.title ?? null,
        progressPercent,
        trainingStatus,
        assessmentStatus,
        passedCount: summary.passedCount,
        failedCount: summary.failedCount,
        pendingCount: summary.pendingCount,
        latestAssessmentTitle: summary.latest?.quizTitle ?? null,
        latestScore: summary.latest?.score ?? null,
        lastActivityAt,
      } satisfies TraineeRosterRow;
    }),
  );

  const jurisdictionCounts = { QLD: 0, NSW: 0, VIC: 0, UK: 0 };
  for (const row of rows) {
    if (row.jurisdiction) jurisdictionCounts[row.jurisdiction]++;
  }

  const totalTrainees = rows.length;
  const currentlyTraining = rows.filter((r) => r.trainingStatus === "IN_PROGRESS").length;
  const completed = rows.filter((r) => r.trainingStatus === "COMPLETED").length;
  const needsAttention = rows.filter((r) => r.trainingStatus === "NEEDS_ATTENTION").length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Assessment & Trainee Progress</h1>
        <p className="text-muted-foreground">
          How every trainee and VA is actually doing — what they&apos;ve passed, what they still need, and
          who needs a look — in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Trainees" value={totalTrainees} icon={Users} />
        <StatCard label="Currently Training" value={currentlyTraining} icon={TrendingUp} />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="success" />
        <StatCard
          label="Needs Attention"
          value={needsAttention}
          icon={AlertTriangle}
          tone={needsAttention > 0 ? "warning" : "default"}
        />
      </div>

      <TraineeAssessmentRoster trainees={rows} jurisdictionCounts={jurisdictionCounts} />
    </div>
  );
}
