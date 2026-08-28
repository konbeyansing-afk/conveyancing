/**
 * Work Status pure logic. These are pure, so every branch is cheap to pin
 * down here rather than through the database-backed action tests.
 */

import { describe, expect, it } from "vitest";
import {
  APP_TIMEZONE,
  classifyVaState,
  computeDailySummary,
  dayKey,
  hasNoRecentUpdate,
  isSameAppDay,
  isValidStatusTransition,
  needsBlockedReason,
  pickRepresentativeItem,
  summarizeStatuses,
} from "@/lib/work-status";

describe("isValidStatusTransition", () => {
  it("allows the same status (a plain edit or note)", () => {
    expect(isValidStatusTransition("IN_PROGRESS", "IN_PROGRESS")).toBe(true);
  });

  it("allows the documented forward path", () => {
    expect(isValidStatusTransition("NOT_STARTED", "IN_PROGRESS")).toBe(true);
    expect(isValidStatusTransition("IN_PROGRESS", "WAITING_PENDING")).toBe(true);
    expect(isValidStatusTransition("IN_PROGRESS", "BLOCKED")).toBe(true);
    expect(isValidStatusTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(isValidStatusTransition("WAITING_PENDING", "IN_PROGRESS")).toBe(true);
    expect(isValidStatusTransition("BLOCKED", "IN_PROGRESS")).toBe(true);
  });

  it("allows reopening a completed task", () => {
    expect(isValidStatusTransition("COMPLETED", "IN_PROGRESS")).toBe(true);
  });

  it("rejects skipping straight from Not Started to Completed", () => {
    expect(isValidStatusTransition("NOT_STARTED", "COMPLETED")).toBe(false);
  });

  it("rejects a completed task jumping to Blocked or Pending directly", () => {
    expect(isValidStatusTransition("COMPLETED", "BLOCKED")).toBe(false);
    expect(isValidStatusTransition("COMPLETED", "WAITING_PENDING")).toBe(false);
  });
});

describe("needsBlockedReason", () => {
  it("requires a reason only for Blocked", () => {
    expect(needsBlockedReason("BLOCKED")).toBe(true);
    expect(needsBlockedReason("IN_PROGRESS")).toBe(false);
    expect(needsBlockedReason("COMPLETED")).toBe(false);
  });
});

describe("summarizeStatuses", () => {
  it("counts every status, including zero counts", () => {
    const counts = summarizeStatuses([
      { status: "IN_PROGRESS" },
      { status: "IN_PROGRESS" },
      { status: "COMPLETED" },
    ]);
    expect(counts).toEqual({
      NOT_STARTED: 0,
      IN_PROGRESS: 2,
      WAITING_PENDING: 0,
      BLOCKED: 0,
      COMPLETED: 1,
    });
  });
});

describe("dayKey / isSameAppDay", () => {
  it("keys by the Brisbane calendar day regardless of UTC rollover", () => {
    // 23:30 Brisbane on 2026-03-04 is 13:30 UTC the same day.
    const late = new Date("2026-03-04T13:30:00.000Z");
    // 00:15 Brisbane the next calendar day is 14:15 UTC.
    const justAfterMidnight = new Date("2026-03-04T14:15:00.000Z");
    expect(dayKey(late)).toBe("2026-03-04");
    expect(dayKey(justAfterMidnight)).toBe("2026-03-05");
    expect(isSameAppDay(late, justAfterMidnight)).toBe(false);
  });

  it("treats the same Brisbane day as equal even in a different zone's calendar day", () => {
    const a = new Date("2026-03-04T23:00:00.000+10:00");
    const b = new Date("2026-03-04T01:00:00.000+10:00");
    expect(isSameAppDay(a, b, APP_TIMEZONE)).toBe(true);
  });
});

describe("computeDailySummary", () => {
  const now = new Date("2026-03-04T05:00:00.000Z"); // 15:00 Brisbane

  it("counts current-state totals and only today's completions", () => {
    const items = [
      { status: "IN_PROGRESS" as const, completedAt: null },
      { status: "WAITING_PENDING" as const, completedAt: null },
      { status: "NOT_STARTED" as const, completedAt: null },
      { status: "BLOCKED" as const, completedAt: null },
      // Completed today.
      { status: "COMPLETED" as const, completedAt: new Date("2026-03-04T04:00:00.000Z") },
      // Completed yesterday — must not count toward today's total.
      { status: "COMPLETED" as const, completedAt: new Date("2026-03-03T04:00:00.000Z") },
    ];
    const activityToday = [
      { createdAt: new Date("2026-03-04T00:00:00.000Z") },
      { createdAt: new Date("2026-03-04T04:00:00.000Z") },
    ];

    const summary = computeDailySummary(items, activityToday, now);

    expect(summary).toEqual({
      completed: 1,
      inProgress: 1,
      pending: 2, // WAITING_PENDING + NOT_STARTED
      blocked: 1,
      totalUpdates: 2,
      firstUpdateAt: activityToday[0].createdAt,
      lastUpdateAt: activityToday[1].createdAt,
    });
  });

  it("returns nulls and zero when there is no activity", () => {
    const summary = computeDailySummary([], [], now);
    expect(summary.totalUpdates).toBe(0);
    expect(summary.firstUpdateAt).toBeNull();
    expect(summary.lastUpdateAt).toBeNull();
  });
});

describe("hasNoRecentUpdate", () => {
  const now = new Date("2026-03-04T05:00:00.000Z");

  it("is true when there has never been an update", () => {
    expect(hasNoRecentUpdate(null, now)).toBe(true);
  });

  it("is false for an update earlier today", () => {
    expect(hasNoRecentUpdate(new Date("2026-03-04T01:00:00.000Z"), now)).toBe(false);
  });

  it("is true for an update from a previous day, however recent in hours", () => {
    // 4:59am today Brisbane-relative-to-yesterday boundary — still "yesterday".
    expect(hasNoRecentUpdate(new Date("2026-03-03T13:59:00.000Z"), now)).toBe(true);
  });
});

describe("classifyVaState", () => {
  it("prioritises Working over Blocked over Pending", () => {
    expect(classifyVaState([{ status: "IN_PROGRESS" }, { status: "BLOCKED" }])).toBe("working");
    expect(classifyVaState([{ status: "BLOCKED" }, { status: "NOT_STARTED" }])).toBe("blocked");
    expect(classifyVaState([{ status: "WAITING_PENDING" }])).toBe("pending");
  });

  it("is idle only when nothing is active, blocked, or queued", () => {
    expect(classifyVaState([{ status: "COMPLETED" }])).toBe("idle");
    expect(classifyVaState([])).toBe("idle");
  });
});

describe("pickRepresentativeItem", () => {
  const base = { updatedAt: new Date("2026-03-04T00:00:00.000Z") };
  const older = { updatedAt: new Date("2026-03-01T00:00:00.000Z") };

  it("always prefers the in-progress item", () => {
    const items = [
      { ...older, status: "BLOCKED" as const, id: "blocked" },
      { ...base, status: "IN_PROGRESS" as const, id: "active" },
    ];
    expect(pickRepresentativeItem(items)?.id).toBe("active");
  });

  it("falls back to the most recently updated blocker", () => {
    const items = [
      { ...older, status: "BLOCKED" as const, id: "old-block" },
      { ...base, status: "BLOCKED" as const, id: "new-block" },
      { ...older, status: "WAITING_PENDING" as const, id: "queued" },
    ];
    expect(pickRepresentativeItem(items)?.id).toBe("new-block");
  });

  it("falls back to the most recently updated queued item, then null", () => {
    const items = [
      { ...older, status: "NOT_STARTED" as const, id: "old-queued" },
      { ...base, status: "WAITING_PENDING" as const, id: "new-queued" },
    ];
    expect(pickRepresentativeItem(items)?.id).toBe("new-queued");
    expect(pickRepresentativeItem([{ ...base, status: "COMPLETED" as const, id: "done" }])).toBeNull();
  });
});
