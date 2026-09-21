/**
 * Admin Assessments dashboard — pure composition logic over data the trainee
 * profile and roster pages already fetch (enrollments, lesson progress, quiz
 * attempts). No I/O, so every status/needs-attention/activity rule here is
 * exhaustively unit-testable without a database, matching the pattern of
 * va-dashboard.ts/checklist.ts.
 *
 * Nothing here invents data: an empty input always produces an empty or
 * "not started" result, never a fabricated status or alert.
 */

export type TrainingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_ATTENTION";

export type AssessmentStatus = "NOT_ATTEMPTED" | "PASSED" | "FAILED" | "IN_PROGRESS";

export type AttemptLike = {
  quizId: string;
  quizTitle: string;
  score: number;
  passed: boolean;
  submittedAt: Date | null;
  /**
   * Optional course/stage label for disambiguating a Needs Attention reason
   * — several quizzes across this codebase's real content share generic
   * titles like "Quick Check", so the title alone can't tell an admin which
   * one to go look at.
   */
  context?: string;
};

/**
 * A quiz counts as an unresolved failure if the *most recent submitted*
 * attempt on it failed — a later pass on the same quiz resolves an earlier
 * fail, but a fail after a pass (e.g. a required re-check) does not.
 */
export function hasUnresolvedFailedAssessment(attempts: AttemptLike[]): boolean {
  const latestByQuiz = new Map<string, AttemptLike>();
  for (const attempt of attempts) {
    if (!attempt.submittedAt) continue;
    const current = latestByQuiz.get(attempt.quizId);
    if (!current || attempt.submittedAt > current.submittedAt!) {
      latestByQuiz.set(attempt.quizId, attempt);
    }
  }
  return [...latestByQuiz.values()].some((a) => !a.passed);
}

/** The trainee's overall standing across every assessment they've touched. */
export function computeOverallAssessmentStatus(attempts: AttemptLike[]): AssessmentStatus {
  if (attempts.length === 0) return "NOT_ATTEMPTED";
  if (hasUnresolvedFailedAssessment(attempts)) return "FAILED";
  if (attempts.some((a) => !a.submittedAt)) return "IN_PROGRESS";
  return "PASSED";
}

const STALE_ACTIVITY_DAYS = 14;

/**
 * Needs Attention (spec default, confirmed with the user): an unresolved
 * failed assessment, or zero activity in the last 14 days. Both are checked
 * independently — a trainee can be flagged for either or both reasons.
 */
export function computeNeedsAttentionReasons(input: {
  attempts: AttemptLike[];
  lastActivityAt: Date | null;
  now?: Date;
}): string[] {
  const now = input.now ?? new Date();
  const reasons: string[] = [];

  const latestByQuiz = new Map<string, AttemptLike>();
  for (const attempt of input.attempts) {
    if (!attempt.submittedAt) continue;
    const current = latestByQuiz.get(attempt.quizId);
    if (!current || attempt.submittedAt > current.submittedAt!) {
      latestByQuiz.set(attempt.quizId, attempt);
    }
  }
  for (const attempt of latestByQuiz.values()) {
    if (!attempt.passed) {
      const label = attempt.context ? `${attempt.quizTitle} — ${attempt.context}` : attempt.quizTitle;
      reasons.push(`Assessment Failed — ${label} (${attempt.score}%)`);
    }
  }

  if (!input.lastActivityAt) {
    reasons.push("No activity yet");
  } else {
    const daysSince = Math.floor((now.getTime() - input.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= STALE_ACTIVITY_DAYS) {
      reasons.push(`No activity in ${daysSince} days`);
    }
  }

  return reasons;
}

/**
 * Not Started / In Progress / Completed / Needs Attention. Needs Attention
 * overrides the other three whenever it applies — a trainee who is 90%
 * through their program but has an unresolved fail still needs a look.
 */
export function computeTrainingStatus(input: {
  isEnrolled: boolean;
  progressPercent: number;
  needsAttention: boolean;
}): TrainingStatus {
  if (input.needsAttention) return "NEEDS_ATTENTION";
  if (!input.isEnrolled || input.progressPercent <= 0) return "NOT_STARTED";
  if (input.progressPercent >= 100) return "COMPLETED";
  return "IN_PROGRESS";
}

export type AttemptSummary = {
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  avgScore: number | null;
  latest: AttemptLike | null;
};

/** Passed/Failed are submitted attempts; Pending is an attempt awaiting submission (submittedAt: null). */
export function summarizeAttempts(attempts: AttemptLike[]): AttemptSummary {
  const submitted = attempts.filter((a) => a.submittedAt);
  const pending = attempts.filter((a) => !a.submittedAt);
  const latest = [...submitted].sort((a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime())[0] ?? null;

  return {
    passedCount: submitted.filter((a) => a.passed).length,
    failedCount: submitted.filter((a) => !a.passed).length,
    pendingCount: pending.length,
    avgScore: submitted.length > 0 ? Math.round(submitted.reduce((s, a) => s + a.score, 0) / submitted.length) : null,
    latest,
  };
}

export type TrainingActivityEntry = {
  key: string;
  kind: "lesson-completed" | "quiz-attempt";
  when: Date;
  detail: string;
};

export type LessonCompletionLike = { lessonId: string; lessonTitle: string; completedAt: Date };

/** Merges lesson completions and quiz attempts into one chronological feed, most recent first. */
export function buildTrainingActivityFeed(
  lessonCompletions: LessonCompletionLike[],
  quizAttempts: AttemptLike[],
  limit = 20,
): TrainingActivityEntry[] {
  const fromLessons: TrainingActivityEntry[] = lessonCompletions.map((l) => ({
    key: `lesson-${l.lessonId}`,
    kind: "lesson-completed",
    when: l.completedAt,
    detail: `Completed "${l.lessonTitle}"`,
  }));

  const fromAttempts: TrainingActivityEntry[] = quizAttempts
    .filter((a): a is AttemptLike & { submittedAt: Date } => !!a.submittedAt)
    .map((a) => ({
      key: `attempt-${a.quizId}-${a.submittedAt.getTime()}`,
      kind: "quiz-attempt",
      when: a.submittedAt,
      detail: `${a.passed ? "Passed" : "Failed"} "${a.quizTitle}" — ${a.score}%`,
    }));

  return [...fromLessons, ...fromAttempts].sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, limit);
}
