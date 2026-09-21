import { describe, expect, it } from "vitest";
import {
  buildTrainingActivityFeed,
  computeNeedsAttentionReasons,
  computeOverallAssessmentStatus,
  computeTrainingStatus,
  hasUnresolvedFailedAssessment,
  summarizeAttempts,
  type AttemptLike,
} from "@/lib/assessment-dashboard";

function attempt(overrides: Partial<AttemptLike>): AttemptLike {
  return {
    quizId: "quiz-1",
    quizTitle: "Knowledge Check",
    score: 80,
    passed: true,
    submittedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("hasUnresolvedFailedAssessment", () => {
  it("is false with no attempts", () => {
    expect(hasUnresolvedFailedAssessment([])).toBe(false);
  });

  it("is false when the latest attempt on a quiz passed", () => {
    const attempts = [
      attempt({ passed: false, score: 40, submittedAt: new Date("2026-01-01") }),
      attempt({ passed: true, score: 90, submittedAt: new Date("2026-01-02") }),
    ];
    expect(hasUnresolvedFailedAssessment(attempts)).toBe(false);
  });

  it("is true when the latest attempt on a quiz failed", () => {
    const attempts = [
      attempt({ passed: true, score: 90, submittedAt: new Date("2026-01-01") }),
      attempt({ passed: false, score: 40, submittedAt: new Date("2026-01-02") }),
    ];
    expect(hasUnresolvedFailedAssessment(attempts)).toBe(true);
  });

  it("ignores unsubmitted (pending) attempts", () => {
    const attempts = [attempt({ passed: false, score: 0, submittedAt: null })];
    expect(hasUnresolvedFailedAssessment(attempts)).toBe(false);
  });

  it("evaluates each quiz independently", () => {
    const attempts = [
      attempt({ quizId: "quiz-1", passed: true, submittedAt: new Date("2026-01-01") }),
      attempt({ quizId: "quiz-2", passed: false, submittedAt: new Date("2026-01-01") }),
    ];
    expect(hasUnresolvedFailedAssessment(attempts)).toBe(true);
  });
});

describe("computeOverallAssessmentStatus", () => {
  it("is NOT_ATTEMPTED with zero attempts", () => {
    expect(computeOverallAssessmentStatus([])).toBe("NOT_ATTEMPTED");
  });

  it("is FAILED when there's an unresolved failure", () => {
    expect(computeOverallAssessmentStatus([attempt({ passed: false })])).toBe("FAILED");
  });

  it("is IN_PROGRESS when a pending attempt exists and nothing is unresolved-failed", () => {
    const attempts = [attempt({ passed: true }), attempt({ quizId: "quiz-2", submittedAt: null })];
    expect(computeOverallAssessmentStatus(attempts)).toBe("IN_PROGRESS");
  });

  it("is PASSED when everything submitted has resolved to a pass", () => {
    expect(computeOverallAssessmentStatus([attempt({ passed: true })])).toBe("PASSED");
  });
});

describe("computeNeedsAttentionReasons", () => {
  const now = new Date("2026-09-17T00:00:00Z");

  it("returns no reasons for an active, all-passed trainee", () => {
    const reasons = computeNeedsAttentionReasons({
      attempts: [attempt({ passed: true })],
      lastActivityAt: new Date("2026-09-16T00:00:00Z"),
      now,
    });
    expect(reasons).toEqual([]);
  });

  it("flags an unresolved failed assessment by name and score", () => {
    const reasons = computeNeedsAttentionReasons({
      attempts: [attempt({ quizTitle: "Finance Clause Check", passed: false, score: 65 })],
      lastActivityAt: now,
      now,
    });
    expect(reasons).toEqual(["Assessment Failed — Finance Clause Check (65%)"]);
  });

  it("disambiguates same-titled quizzes across different courses using context", () => {
    const reasons = computeNeedsAttentionReasons({
      attempts: [
        attempt({ quizId: "q1", quizTitle: "Quick Check", context: "Module 1", passed: false, score: 0 }),
        attempt({ quizId: "q2", quizTitle: "Quick Check", context: "Module 2", passed: false, score: 0 }),
      ],
      lastActivityAt: now,
      now,
    });
    expect(reasons).toEqual([
      "Assessment Failed — Quick Check — Module 1 (0%)",
      "Assessment Failed — Quick Check — Module 2 (0%)",
    ]);
  });

  it("flags stale activity (14+ days) with the exact day count", () => {
    const reasons = computeNeedsAttentionReasons({
      attempts: [],
      lastActivityAt: new Date("2026-09-01T00:00:00Z"),
      now,
    });
    expect(reasons).toEqual(["No activity in 16 days"]);
  });

  it("flags never-active trainees distinctly from stale ones", () => {
    const reasons = computeNeedsAttentionReasons({ attempts: [], lastActivityAt: null, now });
    expect(reasons).toEqual(["No activity yet"]);
  });

  it("does not flag activity inside the 14-day window", () => {
    const reasons = computeNeedsAttentionReasons({
      attempts: [attempt({ passed: true })],
      lastActivityAt: new Date("2026-09-05T00:00:00Z"),
      now,
    });
    expect(reasons).toEqual([]);
  });

  it("can return both reasons at once", () => {
    const reasons = computeNeedsAttentionReasons({
      attempts: [attempt({ passed: false })],
      lastActivityAt: new Date("2026-08-01T00:00:00Z"),
      now,
    });
    expect(reasons).toHaveLength(2);
  });
});

describe("computeTrainingStatus", () => {
  it("is NEEDS_ATTENTION regardless of progress when flagged", () => {
    expect(computeTrainingStatus({ isEnrolled: true, progressPercent: 90, needsAttention: true })).toBe(
      "NEEDS_ATTENTION",
    );
  });

  it("is NOT_STARTED when not enrolled", () => {
    expect(computeTrainingStatus({ isEnrolled: false, progressPercent: 0, needsAttention: false })).toBe(
      "NOT_STARTED",
    );
  });

  it("is NOT_STARTED when enrolled but zero progress", () => {
    expect(computeTrainingStatus({ isEnrolled: true, progressPercent: 0, needsAttention: false })).toBe(
      "NOT_STARTED",
    );
  });

  it("is IN_PROGRESS for partial progress", () => {
    expect(computeTrainingStatus({ isEnrolled: true, progressPercent: 45, needsAttention: false })).toBe(
      "IN_PROGRESS",
    );
  });

  it("is COMPLETED at 100%", () => {
    expect(computeTrainingStatus({ isEnrolled: true, progressPercent: 100, needsAttention: false })).toBe(
      "COMPLETED",
    );
  });
});

describe("summarizeAttempts", () => {
  it("handles zero attempts", () => {
    expect(summarizeAttempts([])).toEqual({
      passedCount: 0,
      failedCount: 0,
      pendingCount: 0,
      avgScore: null,
      latest: null,
    });
  });

  it("buckets passed, failed and pending correctly", () => {
    const attempts = [
      attempt({ passed: true, score: 90, submittedAt: new Date("2026-01-01") }),
      attempt({ passed: false, score: 40, submittedAt: new Date("2026-01-02") }),
      attempt({ submittedAt: null }),
    ];
    const summary = summarizeAttempts(attempts);
    expect(summary.passedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.avgScore).toBe(65);
  });

  it("picks the most recently submitted attempt as latest", () => {
    const attempts = [
      attempt({ quizTitle: "Older", submittedAt: new Date("2026-01-01") }),
      attempt({ quizTitle: "Newer", submittedAt: new Date("2026-02-01") }),
    ];
    expect(summarizeAttempts(attempts).latest?.quizTitle).toBe("Newer");
  });
});

describe("buildTrainingActivityFeed", () => {
  it("returns an empty feed for no activity", () => {
    expect(buildTrainingActivityFeed([], [])).toEqual([]);
  });

  it("merges lessons and attempts, most recent first", () => {
    const feed = buildTrainingActivityFeed(
      [{ lessonId: "l1", lessonTitle: "Intro", completedAt: new Date("2026-01-01") }],
      [attempt({ submittedAt: new Date("2026-01-02") })],
    );
    expect(feed).toHaveLength(2);
    expect(feed[0].kind).toBe("quiz-attempt");
    expect(feed[1].kind).toBe("lesson-completed");
  });

  it("excludes pending (unsubmitted) attempts from the feed", () => {
    const feed = buildTrainingActivityFeed([], [attempt({ submittedAt: null })]);
    expect(feed).toEqual([]);
  });

  it("respects the limit", () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      attempt({ quizId: `q${i}`, submittedAt: new Date(2026, 0, i + 1) }),
    );
    expect(buildTrainingActivityFeed([], attempts, 2)).toHaveLength(2);
  });
});
