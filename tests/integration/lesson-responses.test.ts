/**
 * Lesson fill-in answers, exercised through the real server action against the
 * real database: a trainee only ever writes their own rows, only into a lesson
 * they could actually open, and clearing a field removes it.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertDatabaseReachable,
  cleanup,
  createCourseWithLessons,
  createProgram,
  createStage,
  createUser,
  enrol,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const session: { user: { id: string; name: string; email: string; role: string } | null } = { user: null };

vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { MAX_RESPONSE_LENGTH } from "@/lib/lesson-fields";

const { saveLessonResponses } = await import("@/lib/actions/lesson-responses");

let trainee: Awaited<ReturnType<typeof createUser>>;
let otherTrainee: Awaited<ReturnType<typeof createUser>>;
let notEnrolled: Awaited<ReturnType<typeof createUser>>;
let lessonId: string;

const as = (u: { id: string; name: string; email: string }, role = "TRAINEE") =>
  (session.user = { id: u.id, name: u.name, email: u.email, role });

const rows = (userId: string) =>
  prisma.lessonResponse.findMany({ where: { lessonId, userId }, orderBy: { fieldKey: "asc" } });

beforeAll(async () => {
  await assertDatabaseReachable();
  trainee = await createUser("TRAINEE", "responses");
  otherTrainee = await createUser("TRAINEE", "responses-other");
  notEnrolled = await createUser("TRAINEE", "responses-notenrolled");

  const program = await createProgram();
  const stage = await createStage(program.id, { order: 0, title: "Responses Stage" });
  const course = await createCourseWithLessons(program.id, stage.id, { title: "Responses Course", lessonCount: 1 });
  lessonId = course.modules[0].lessons[0].id;
  await enrol(trainee.id, course.id);
  await enrol(otherTrainee.id, course.id);
});

afterAll(async () => {
  await cleanup();
});

describe("saveLessonResponses", () => {
  it("refuses an unauthenticated caller", async () => {
    session.user = null;
    const result = await saveLessonResponses(lessonId, [{ key: "s0-blank-0", label: "Name", value: "x" }]);
    expect(result.ok).toBe(false);
  });

  it("stores a trainee's answers against their own account", async () => {
    as(trainee);
    const result = await saveLessonResponses(lessonId, [
      { key: "s2-cell-0", label: "Row 1 — Action", value: "Re-read the contract" },
      { key: "s2-blank-0", label: "Signature", value: "P. Castro" },
      { key: "s2-box-0", label: "I have read this", value: "checked" },
    ]);
    expect(result.ok).toBe(true);

    const saved = await rows(trainee.id);
    expect(saved.map((r) => [r.fieldKey, r.value])).toEqual([
      ["s2-blank-0", "P. Castro"],
      ["s2-box-0", "checked"],
      ["s2-cell-0", "Re-read the contract"],
    ]);
    expect(saved.find((r) => r.fieldKey === "s2-blank-0")?.label).toBe("Signature");
  });

  it("stores written answers to assessment prompts, keyed as answers", async () => {
    as(trainee);
    const result = await saveLessonResponses(lessonId, [
      { key: "s4-ans-7", label: "Scenario 3 — 1. What is the correct immediate response?", value: "Stop and escalate to the supervisor" },
    ]);
    expect(result.ok).toBe(true);
    const saved = (await rows(trainee.id)).find((r) => r.fieldKey === "s4-ans-7");
    expect(saved?.value).toBe("Stop and escalate to the supervisor");
    expect(saved?.label).toContain("Scenario 3");
  });

  it("updates an existing answer instead of adding a second row", async () => {
    as(trainee);
    await saveLessonResponses(lessonId, [{ key: "s2-blank-0", label: "Signature", value: "Princess Castro" }]);
    const saved = (await rows(trainee.id)).filter((r) => r.fieldKey === "s2-blank-0");
    expect(saved).toHaveLength(1);
    expect(saved[0].value).toBe("Princess Castro");
  });

  it("removes the row when an answer is cleared", async () => {
    as(trainee);
    await saveLessonResponses(lessonId, [{ key: "s2-box-0", label: "I have read this", value: "" }]);
    expect((await rows(trainee.id)).some((r) => r.fieldKey === "s2-box-0")).toBe(false);
  });

  it("never lets one trainee touch another's answers", async () => {
    as(otherTrainee);
    await saveLessonResponses(lessonId, [{ key: "s2-blank-0", label: "Signature", value: "Someone Else" }]);
    expect((await rows(trainee.id)).find((r) => r.fieldKey === "s2-blank-0")?.value).toBe("Princess Castro");
    expect((await rows(otherTrainee.id)).find((r) => r.fieldKey === "s2-blank-0")?.value).toBe("Someone Else");
  });

  it("refuses a trainee who is not enrolled in the lesson's course", async () => {
    as(notEnrolled);
    const result = await saveLessonResponses(lessonId, [{ key: "s0-blank-0", label: "x", value: "nope" }]);
    expect(result.ok).toBe(false);
    expect(await rows(notEnrolled.id)).toHaveLength(0);
  });

  it("refuses malformed field keys", async () => {
    as(trainee);
    for (const key of ["", "s0", "../etc", "s0-blank-0; DROP TABLE", "x1-cell-0"]) {
      const result = await saveLessonResponses(lessonId, [{ key, label: "x", value: "y" }]);
      expect(result.ok, key).toBe(false);
    }
  });

  it("refuses an over-long answer", async () => {
    as(trainee);
    const result = await saveLessonResponses(lessonId, [
      { key: "s3-blank-0", label: "x", value: "a".repeat(MAX_RESPONSE_LENGTH + 1) },
    ]);
    expect(result.ok).toBe(false);
  });

  it("reports an unknown lesson without throwing", async () => {
    as(trainee);
    const result = await saveLessonResponses("does-not-exist", [{ key: "s0-blank-0", label: "x", value: "y" }]);
    expect(result.ok).toBe(false);
  });
});

describe("stable keys and re-keying", () => {
  const KEY_A = "f-0a1b2c3d4e5f60";
  const KEY_B = "f-1a1b2c3d4e5f61";
  const KEY_C = "f-2a1b2c3d4e5f62";

  const find = (userId: string, fieldKey: string) =>
    prisma.lessonResponse.findUnique({ where: { lessonId_userId_fieldKey: { lessonId, userId, fieldKey } } });

  it("stores a stable key with its section, position and key id", async () => {
    as(trainee);
    const result = await saveLessonResponses(lessonId, [
      { key: KEY_A, label: "Scenario 1 — 1. What is the correct immediate response?", section: "Part G", position: 4, value: "Escalate" },
    ]);
    expect(result.ok).toBe(true);
    const row = await find(trainee.id, KEY_A);
    expect(row).toMatchObject({ fieldId: KEY_A.slice(2), section: "Part G", position: 4, value: "Escalate", needsReview: false });
  });

  it("re-keys a legacy row in place: same record, no copy, old key kept for audit", async () => {
    as(trainee);
    await saveLessonResponses(lessonId, [{ key: "s6-blank-2", label: "Signature", value: "first draft" }]);
    const before = await find(trainee.id, "s6-blank-2");
    expect(before).not.toBeNull();

    const result = await saveLessonResponses(lessonId, [
      { key: KEY_B, legacyKey: "s6-blank-2", label: "Signature", section: "Acknowledgement", position: 2, value: "final" },
    ]);
    expect(result.ok).toBe(true);

    expect(await find(trainee.id, "s6-blank-2")).toBeNull();
    const after = await find(trainee.id, KEY_B);
    expect(after?.id).toBe(before!.id);
    expect(after).toMatchObject({ value: "final", fieldId: KEY_B.slice(2), legacyKey: "s6-blank-2", section: "Acknowledgement" });
    expect(after!.createdAt.getTime()).toBe(before!.createdAt.getTime());
  });

  it("keeps a legacy row untouched when the stable key already has an answer", async () => {
    as(trainee);
    await saveLessonResponses(lessonId, [
      { key: "s7-blank-0", label: "Date", value: "legacy value" },
      { key: KEY_C, label: "Date", value: "current value" },
    ]);
    await saveLessonResponses(lessonId, [{ key: KEY_C, legacyKey: "s7-blank-0", label: "Date", value: "edited" }]);
    expect((await find(trainee.id, "s7-blank-0"))?.value).toBe("legacy value");
    expect((await find(trainee.id, KEY_C))?.value).toBe("edited");
  });

  it("removes the answer under either key when the field is cleared", async () => {
    as(trainee);
    await saveLessonResponses(lessonId, [{ key: "s8-blank-0", label: "Name", value: "to clear" }]);
    await saveLessonResponses(lessonId, [{ key: "f-3a1b2c3d4e5f63", legacyKey: "s8-blank-0", label: "Name", value: "" }]);
    expect(await find(trainee.id, "s8-blank-0")).toBeNull();
  });

  it("never re-keys another trainee's legacy row", async () => {
    as(otherTrainee);
    await saveLessonResponses(lessonId, [{ key: "s9-blank-0", label: "Name", value: "other's answer" }]);

    as(trainee);
    await saveLessonResponses(lessonId, [
      { key: "f-4a1b2c3d4e5f64", legacyKey: "s9-blank-0", label: "Name", value: "mine" },
    ]);

    expect((await find(otherTrainee.id, "s9-blank-0"))?.value).toBe("other's answer");
    expect(await find(otherTrainee.id, "f-4a1b2c3d4e5f64")).toBeNull();
    expect((await find(trainee.id, "f-4a1b2c3d4e5f64"))?.value).toBe("mine");
  });

  it("refuses a malformed stable or legacy key", async () => {
    as(trainee);
    for (const entry of [
      { key: "f-short", label: "x", value: "y" },
      { key: "f-0a1b2c3d4e5f60", legacyKey: "not-a-key", label: "x", value: "y" },
      { key: "f-ZZZZZZZZZZZZZZ", label: "x", value: "y" },
    ]) {
      const result = await saveLessonResponses(lessonId, [entry]);
      expect(result.ok, JSON.stringify(entry)).toBe(false);
    }
  });
});
