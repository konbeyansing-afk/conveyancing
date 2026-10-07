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

const { saveLessonResponses, MAX_RESPONSE_LENGTH } = await import("@/lib/actions/lesson-responses");

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
