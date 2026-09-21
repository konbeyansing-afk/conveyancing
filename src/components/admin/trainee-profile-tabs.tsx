"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Lock } from "lucide-react";
import { Tabs, TabsIndicator, TabsList, TabsTab } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { TraineeNotes } from "@/components/trainer/trainee-notes";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { StageJourneyStatus } from "@/lib/stage-access";
import type { AssessmentStatus, TrainingActivityEntry } from "@/lib/assessment-dashboard";

type Note = { id: string; body: string; createdAt: Date; author: { name: string }; canDelete: boolean };

export type AssessmentRow = {
  quizId: string;
  quizTitle: string;
  scopeTitle: string;
  courseTitle: string;
  questionCount: number;
  passingScore: number;
  attemptCount: number;
  latestScore: number | null;
  latestPassed: boolean | null;
  latestSubmittedAt: Date | null;
  status: AssessmentStatus;
  latestAttemptId: string | null;
};

export type AttemptRow = {
  id: string;
  quizId: string;
  quizTitle: string;
  scopeTitle: string;
  courseTitle: string;
  score: number;
  passed: boolean;
  submittedAt: Date | null;
};

const ASSESSMENT_STATUS_LABEL: Record<AssessmentStatus, string> = {
  NOT_ATTEMPTED: "Not Attempted",
  PASSED: "Passed",
  FAILED: "Failed",
  IN_PROGRESS: "In Progress",
};

function assessmentBadgeVariant(status: AssessmentStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PASSED":
      return "default";
    case "FAILED":
      return "destructive";
    case "IN_PROGRESS":
      return "secondary";
    default:
      return "outline";
  }
}

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "training", label: "Training Progress" },
  { value: "assessments", label: "Assessments" },
  { value: "attempts", label: "Attempts" },
  { value: "activity", label: "Activity" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export function TraineeProfileTabs({
  traineeId,
  overview,
  needsAttentionReasons,
  notes,
  programTitle,
  stages,
  assessments,
  attempts,
  activity,
}: {
  traineeId: string;
  overview: {
    progressPercent: number;
    lessonsCompleted: number;
    lessonsTotal: number;
    passedCount: number;
    failedCount: number;
    pendingCount: number;
    avgScore: number | null;
  };
  needsAttentionReasons: string[];
  notes: Note[];
  programTitle: string | null;
  stages: StageJourneyStatus[];
  assessments: AssessmentRow[];
  attempts: AttemptRow[];
  activity: TrainingActivityEntry[];
}) {
  const [tab, setTab] = useState<TabValue>("overview");

  return (
    <div className="grid gap-4">
      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)} className="min-w-0">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsIndicator />
          {TABS.map((t) => (
            <TabsTab key={t.value} value={t.value}>
              {t.label}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      {tab === "overview" && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card>
              <CardContent className="grid gap-1">
                <p className="text-2xl font-semibold tabular-nums">{overview.progressPercent}%</p>
                <p className="text-sm text-muted-foreground">Overall progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-1">
                <p className="text-2xl font-semibold tabular-nums">
                  {overview.lessonsCompleted}/{overview.lessonsTotal}
                </p>
                <p className="text-sm text-muted-foreground">Lessons completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-1">
                <p className="text-2xl font-semibold tabular-nums">
                  {overview.avgScore !== null ? `${overview.avgScore}%` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Avg. assessment score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-1">
                <p className="text-2xl font-semibold tabular-nums text-success">{overview.passedCount}</p>
                <p className="text-sm text-muted-foreground">Assessments passed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-1">
                <p className="text-2xl font-semibold tabular-nums text-destructive">{overview.failedCount}</p>
                <p className="text-sm text-muted-foreground">Assessments failed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-1">
                <p className="text-2xl font-semibold tabular-nums">{overview.pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending attempts</p>
              </CardContent>
            </Card>
          </div>

          {needsAttentionReasons.length > 0 && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <ClipboardCheck className="size-4" />
                  Needs Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1.5 text-sm">
                  {needsAttentionReasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <TraineeNotes traineeId={traineeId} notes={notes} />
        </div>
      )}

      {tab === "training" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Training journey{programTitle ? ` — ${programTitle}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enrolled in a program with stages yet.</p>
            ) : (
              stages.map((stage) => (
                <div key={stage.id} className="grid gap-2 rounded-lg border px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {stage.status === "locked" && <Lock className="size-3.5 shrink-0 text-muted-foreground" />}
                      <p className="min-w-0 truncate font-medium">{stage.title}</p>
                      {stage.status === "completed" && <Badge>Completed</Badge>}
                      {stage.status === "current" && <Badge variant="secondary">In progress</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={stage.progressPercent} className="flex-1" />
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {stage.completedLessons}/{stage.totalLessons}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === "assessments" && (
        <>
          {assessments.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No assessments in their enrolled courses"
              description="Assessments will show up here once their courses include a knowledge check."
            />
          ) : (
            <div className="grid gap-2">
              {assessments.map((a) => (
                <Card key={a.quizId}>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClipboardCheck className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.quizTitle}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.scopeTitle} › {a.courseTitle}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {a.questionCount} question{a.questionCount === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline">Pass ≥ {a.passingScore}%</Badge>
                    {a.attemptCount > 1 && <Badge variant="outline">{a.attemptCount} attempts</Badge>}
                    <div className="w-24 shrink-0 text-right text-sm">
                      <p className="font-semibold tabular-nums">{a.latestScore !== null ? `${a.latestScore}%` : "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.latestSubmittedAt ? formatRelativeTime(a.latestSubmittedAt) : ""}
                      </p>
                    </div>
                    <Badge variant={assessmentBadgeVariant(a.status)} className="shrink-0">
                      {ASSESSMENT_STATUS_LABEL[a.status]}
                    </Badge>
                    {a.latestAttemptId && (
                      <Link
                        href={`/admin/assessments/${a.quizId}/attempts/${a.latestAttemptId}`}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "attempts" && (
        <>
          {attempts.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No attempts yet"
              description="Results will show up here once this person takes a knowledge check."
            />
          ) : (
            <div className="grid gap-2">
              {attempts.map((attempt) => (
                <Link key={attempt.id} href={`/admin/assessments/${attempt.quizId}/attempts/${attempt.id}`}>
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="flex flex-wrap items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ClipboardCheck className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{attempt.quizTitle}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {attempt.scopeTitle} › {attempt.courseTitle}
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
        </>
      )}

      {tab === "activity" && (
        <>
          {activity.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No activity yet"
              description="Lesson completions and assessment attempts will show up here."
            />
          ) : (
            <div className="grid gap-2">
              {activity.map((entry) => (
                <div key={entry.key} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {entry.kind === "lesson-completed" ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <ClipboardCheck className="size-4" />
                    )}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm">{entry.detail}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(entry.when)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
