import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BookOpen, CheckCircle2, ClipboardCheck, Lock } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findScopedTrainee } from "@/lib/trainer-scope";
import { getJourneyForUser, getPrimaryProgramForUser } from "@/lib/stage-access";
import { TraineeNotes } from "@/components/trainer/trainee-notes";
import { SignOffStageButton, WithdrawSignOffButton } from "@/components/trainer/stage-signoff";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const shortDate = (date: Date) =>
  date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/**
 * Everything a trainer needs about one trainee: where they are in the journey,
 * what they scored, what is waiting on a sign-off, and the running notes.
 *
 * Access goes through findScopedTrainee, which returns null — and so a 404 —
 * for anyone not assigned to this trainer. A 404 rather than a "forbidden"
 * means guessing an id tells a trainer nothing about who exists.
 */
export default async function TrainerTraineeDetailPage({
  params,
}: {
  params: Promise<{ traineeId: string }>;
}) {
  const { traineeId } = await params;
  const session = await auth();
  const actor = { id: session!.user.id, role: session!.user.role };

  const trainee = await findScopedTrainee(actor, traineeId);
  if (!trainee) notFound();

  const program = await getPrimaryProgramForUser(trainee.id);
  const stages = program ? await getJourneyForUser(program.id, trainee.id) : [];

  const [approvals, attempts, notes, certificates, awaitingLessonSignOff] = await Promise.all([
    prisma.stageApproval.findMany({
      where: { userId: trainee.id },
      select: {
        stageId: true,
        approvedAt: true,
        notes: true,
        approvedBy: { select: { name: true } },
      },
    }),
    prisma.quizAttempt.findMany({
      where: { userId: trainee.id, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: { quiz: { select: { title: true, passingScore: true } } },
    }),
    prisma.traineeNote.findMany({
      where: { traineeId: trainee.id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
    }),
    prisma.certificate.findMany({
      where: { userId: trainee.id },
      orderBy: { completedAt: "desc" },
    }),
    // Lesson-level sign-offs (distinct from the stage-level ones above): the
    // trainee has already attested, and it's waiting on this trainer's own
    // independent review — see src/lib/actions/lesson-signoff.ts.
    prisma.lessonSignOff.findMany({
      where: { userId: trainee.id, traineeSignedAt: { not: null }, trainerResult: null },
      orderBy: { traineeSignedAt: "desc" },
      include: { lesson: { select: { id: true, title: true, module: { select: { course: { select: { id: true, title: true } } } } } } },
    }),
  ]);

  const approvedStageIds = new Set(approvals.map((a) => a.stageId));
  const completedStages = stages.filter((s) => s.status === "completed").length;
  const totalLessons = stages.reduce((n, s) => n + s.totalLessons, 0);
  const completedLessons = stages.reduce((n, s) => n + s.completedLessons, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Trainees", href: "/trainer/trainees" }, { label: trainee.name }]}
        title={trainee.name}
        description={trainee.email}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Stages completed"
          value={`${completedStages}/${stages.length}`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Lessons completed"
          value={`${completedLessons}/${totalLessons}`}
          icon={BookOpen}
        />
        <StatCard label="Quiz attempts" value={attempts.length} icon={CheckCircle2} />
        <StatCard label="Certificates" value={certificates.length} icon={Award} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Training journey{program ? ` — ${program.title}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This trainee is not enrolled in a program with stages yet.
            </p>
          ) : (
            stages.map((stage) => {
              const approval = approvals.find((a) => a.stageId === stage.id);
              const lessonsDone =
                stage.totalLessons > 0 && stage.completedLessons === stage.totalLessons;
              const needsSignOff =
                stage.requireTrainerApproval && !approvedStageIds.has(stage.id) && lessonsDone;

              return (
                <div key={stage.id} className="grid gap-2 rounded-lg border px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {stage.status === "locked" && (
                        <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <p className="min-w-0 truncate font-medium">{stage.title}</p>
                      {stage.status === "completed" && <Badge>Completed</Badge>}
                      {stage.status === "current" && <Badge variant="secondary">In progress</Badge>}
                      {needsSignOff && <Badge variant="destructive">Needs sign-off</Badge>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {needsSignOff && (
                        <SignOffStageButton
                          traineeId={trainee.id}
                          stageId={stage.id}
                          stageTitle={stage.title}
                          traineeName={trainee.name}
                        />
                      )}
                      {approval && (
                        <WithdrawSignOffButton traineeId={trainee.id} stageId={stage.id} />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Progress value={stage.progressPercent} className="flex-1" />
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {stage.completedLessons}/{stage.totalLessons}
                    </span>
                  </div>

                  {approval && (
                    <p className="text-xs text-muted-foreground">
                      Signed off by {approval.approvedBy.name} on {shortDate(approval.approvedAt)}
                      {approval.notes ? ` — ${approval.notes}` : ""}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {awaitingLessonSignOff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lessons awaiting your sign-off</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {awaitingLessonSignOff.map((s) => (
              <Link
                key={s.id}
                href={`/trainer/trainees/${trainee.id}/courses/${s.lesson.module.course.id}/lessons/${s.lesson.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.lesson.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.lesson.module.course.title}</p>
                </div>
                <Badge variant="destructive" className="shrink-0">
                  <ClipboardCheck className="size-3.5" />
                  Needs review
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quiz attempts yet.</p>
          ) : (
            <ul className="grid gap-2">
              {attempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{attempt.quiz.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {attempt.submittedAt ? shortDate(attempt.submittedAt) : ""} · pass mark{" "}
                      {attempt.quiz.passingScore}%
                    </p>
                  </div>
                  <Badge variant={attempt.passed ? "default" : "destructive"}>
                    {attempt.score}%
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <TraineeNotes
        traineeId={trainee.id}
        notes={notes.map((note) => ({
          id: note.id,
          body: note.body,
          createdAt: note.createdAt,
          author: note.author,
          canDelete: actor.role === "ADMIN" || note.authorId === actor.id,
        }))}
      />
    </div>
  );
}
