import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getJourneyForUser, getPrimaryProgramForUser } from "@/lib/stage-access";
import {
  computeNeedsAttentionReasons,
  computeOverallAssessmentStatus,
  computeTrainingStatus,
  summarizeAttempts,
  buildTrainingActivityFeed,
  type AttemptLike,
} from "@/lib/assessment-dashboard";
import { TraineeProfileTabs, type AssessmentRow, type AttemptRow } from "@/components/admin/trainee-profile-tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const TRAINING_STATUS_LABELS = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  NEEDS_ATTENTION: "Needs Attention",
} as const;

export default async function TraineeAssessmentProfilePage({
  params,
}: {
  params: Promise<{ traineeId: string }>;
}) {
  const { traineeId } = await params;
  const session = await auth();
  const actor = { id: session!.user.id, role: session!.user.role };

  const trainee = await prisma.user.findUnique({
    where: { id: traineeId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!trainee || (trainee.role !== "TRAINEE" && trainee.role !== "VA")) notFound();

  const [program, enrollments, attemptRows, lessonCompletions, notes] = await Promise.all([
    getPrimaryProgramForUser(trainee.id),
    prisma.enrollment.findMany({
      where: { userId: trainee.id },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            program: { select: { title: true } },
            stage: { select: { title: true, program: { select: { title: true } } } },
            quizzes: {
              select: { id: true, title: true, passingScore: true, questions: { select: { id: true } } },
            },
          },
        },
      },
    }),
    prisma.quizAttempt.findMany({
      where: { userId: trainee.id },
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
    }),
    prisma.lessonProgress.findMany({
      where: { userId: trainee.id, completedAt: { not: null } },
      select: { lessonId: true, completedAt: true, lesson: { select: { title: true } } },
    }),
    prisma.traineeNote.findMany({
      where: { traineeId: trainee.id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
    }),
  ]);

  const jurisdiction = program
    ? (await prisma.program.findUnique({ where: { id: program.id }, select: { jurisdiction: true } }))?.jurisdiction ?? null
    : null;
  const stages = program ? await getJourneyForUser(program.id, trainee.id) : [];

  const attempts: AttemptLike[] = attemptRows.map((a) => ({
    quizId: a.quizId,
    quizTitle: a.quiz.title,
    score: a.score,
    passed: a.passed,
    submittedAt: a.submittedAt,
    context: a.quiz.lesson ? `${a.quiz.course.title} — ${a.quiz.lesson.title}` : a.quiz.course.title,
  }));

  const totalLessons = stages.reduce((n, s) => n + s.totalLessons, 0);
  const completedLessons = stages.reduce((n, s) => n + s.completedLessons, 0);
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const lastActivityAt = [
    ...lessonCompletions.map((l) => l.completedAt!),
    ...attempts.filter((a): a is AttemptLike & { submittedAt: Date } => !!a.submittedAt).map((a) => a.submittedAt),
  ].sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const needsAttentionReasons = computeNeedsAttentionReasons({ attempts, lastActivityAt });
  const trainingStatus = computeTrainingStatus({
    isEnrolled: enrollments.length > 0,
    progressPercent,
    needsAttention: needsAttentionReasons.length > 0,
  });
  const summary = summarizeAttempts(attempts);

  // Every assessment belonging to a course the trainee is enrolled in, merged
  // with their actual attempts — including quizzes they haven't touched yet
  // (NOT ATTEMPTED), which a flat attempts list alone could never show.
  const quizzesById = new Map<
    string,
    { quizId: string; quizTitle: string; passingScore: number; questionCount: number; scopeTitle: string; courseTitle: string }
  >();
  for (const enrollment of enrollments) {
    const course = enrollment.course;
    const scopeTitle = course.stage ? course.stage.title : course.program.title;
    for (const quiz of course.quizzes) {
      quizzesById.set(quiz.id, {
        quizId: quiz.id,
        quizTitle: quiz.title,
        passingScore: quiz.passingScore,
        questionCount: quiz.questions.length,
        scopeTitle,
        courseTitle: course.title,
      });
    }
  }

  const attemptsByQuiz = new Map<string, typeof attemptRows>();
  for (const attempt of attemptRows) {
    if (!attemptsByQuiz.has(attempt.quizId)) attemptsByQuiz.set(attempt.quizId, []);
    attemptsByQuiz.get(attempt.quizId)!.push(attempt);
  }
  // A quiz the trainee has attempted might belong to a course they're no
  // longer (or never were formally) enrolled in — still show it, scoped from
  // the attempt's own quiz/course data rather than silently dropping it.
  for (const attempt of attemptRows) {
    if (!quizzesById.has(attempt.quizId)) {
      quizzesById.set(attempt.quizId, {
        quizId: attempt.quiz.id,
        quizTitle: attempt.quiz.title,
        passingScore: attempt.quiz.passingScore,
        questionCount: 0,
        scopeTitle: attempt.quiz.course.stage ? attempt.quiz.course.stage.title : attempt.quiz.course.program.title,
        courseTitle: attempt.quiz.course.title,
      });
    }
  }

  const assessments: AssessmentRow[] = [...quizzesById.values()]
    .map((quiz) => {
      const quizAttempts = attemptsByQuiz.get(quiz.quizId) ?? [];
      const attemptLikes: AttemptLike[] = quizAttempts.map((a) => ({
        quizId: a.quizId,
        quizTitle: a.quiz.title,
        score: a.score,
        passed: a.passed,
        submittedAt: a.submittedAt,
      }));
      const quizSummary = summarizeAttempts(attemptLikes);
      return {
        quizId: quiz.quizId,
        quizTitle: quiz.quizTitle,
        scopeTitle: quiz.scopeTitle,
        courseTitle: quiz.courseTitle,
        questionCount: quiz.questionCount,
        passingScore: quiz.passingScore,
        attemptCount: quizAttempts.length,
        latestScore: quizSummary.latest?.score ?? null,
        latestPassed: quizSummary.latest?.passed ?? null,
        latestSubmittedAt: quizSummary.latest?.submittedAt ?? null,
        status: computeOverallAssessmentStatus(attemptLikes),
        latestAttemptId: quizAttempts.find((a) => a.submittedAt === (quizSummary.latest?.submittedAt ?? null))?.id ?? quizAttempts[0]?.id ?? null,
      } satisfies AssessmentRow;
    })
    .sort((a, b) => a.quizTitle.localeCompare(b.quizTitle));

  const attemptsForTab: AttemptRow[] = attemptRows.map((attempt) => ({
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle: attempt.quiz.title,
    scopeTitle: attempt.quiz.course.stage ? attempt.quiz.course.stage.title : attempt.quiz.course.program.title,
    courseTitle: attempt.quiz.course.title,
    score: attempt.score,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
  }));

  const activity = buildTrainingActivityFeed(
    lessonCompletions.map((l) => ({ lessonId: l.lessonId, lessonTitle: l.lesson.title, completedAt: l.completedAt! })),
    attempts,
  );

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin/assessments"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" /> Assessment & Trainee Progress
        </Link>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <Avatar size="lg">
            <AvatarFallback>{initials(trainee.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{trainee.name}</h1>
              <Badge variant="outline">{trainee.role}</Badge>
              {jurisdiction && <Badge variant="outline">{jurisdiction}</Badge>}
              <Badge variant={trainingStatus === "NEEDS_ATTENTION" ? "destructive" : "secondary"}>
                {TRAINING_STATUS_LABELS[trainingStatus]}
              </Badge>
            </div>
            <p className="text-muted-foreground">{trainee.email}</p>
            <p className="text-sm text-muted-foreground">
              {program ? program.title : "Not enrolled in a program"}
              {lastActivityAt ? ` · Last active ${lastActivityAt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` : " · No activity yet"}
            </p>
          </div>
        </div>
      </div>

      <TraineeProfileTabs
        traineeId={trainee.id}
        overview={{
          progressPercent,
          lessonsCompleted: completedLessons,
          lessonsTotal: totalLessons,
          passedCount: summary.passedCount,
          failedCount: summary.failedCount,
          pendingCount: summary.pendingCount,
          avgScore: summary.avgScore,
        }}
        needsAttentionReasons={needsAttentionReasons}
        notes={notes.map((note) => ({
          id: note.id,
          body: note.body,
          createdAt: note.createdAt,
          author: note.author,
          canDelete: actor.role === "ADMIN" || note.authorId === actor.id,
        }))}
        programTitle={program?.title ?? null}
        stages={stages}
        assessments={assessments}
        attempts={attemptsForTab}
        activity={activity}
      />
    </div>
  );
}
