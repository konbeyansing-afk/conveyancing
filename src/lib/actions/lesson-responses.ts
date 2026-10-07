"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished } from "@/lib/stage-access";

export type SaveLessonResponsesResult = { ok: boolean; error?: string };

export const MAX_RESPONSE_LENGTH = 5000;
const MAX_BATCH = 100;
const FIELD_KEY = /^s\d{1,3}-(cell|blank|box)-\d{1,4}$/;

/**
 * Saves what a trainee typed into a lesson's fill-in fields. Always writes to
 * the signed-in user's own rows — there is no way to name another user — and
 * applies the same access rules as completing the lesson, so a trainee can't
 * store answers against a lesson they couldn't open. An empty value removes
 * the row rather than keeping a blank one.
 */
export async function saveLessonResponses(
  lessonId: string,
  entries: { key: string; label: string; value: string }[],
): Promise<SaveLessonResponsesResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Please sign in again." };

  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_BATCH) {
    return { ok: false, error: "Nothing to save." };
  }
  for (const entry of entries) {
    if (typeof entry.key !== "string" || !FIELD_KEY.test(entry.key)) return { ok: false, error: "Invalid field." };
    if (typeof entry.value !== "string" || typeof entry.label !== "string") return { ok: false, error: "Invalid field." };
    if (entry.value.length > MAX_RESPONSE_LENGTH) {
      return { ok: false, error: `Answers can be up to ${MAX_RESPONSE_LENGTH} characters.` };
    }
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isPublished: true,
      module: {
        select: {
          course: {
            select: {
              id: true,
              isPublished: true,
              program: { select: { isPublished: true } },
              stage: {
                select: { id: true, isPublished: true, program: { select: { isPublished: true } } },
              },
            },
          },
        },
      },
    },
  });
  const course = lesson?.module.course;
  if (!lesson || !course) return { ok: false, error: "Lesson not found." };

  if (!(await canPreviewUnpublished())) {
    const allowed =
      lesson.isPublished &&
      isCoursePublished(course) &&
      (await isEnrolledInCourse(course.id)) &&
      (!course.stage || (await isStageUnlockedForUser(course.stage.id, userId)));
    if (!allowed) return { ok: false, error: "You don't have access to this lesson." };
  }

  // Last write per key wins within a batch.
  const latest = new Map(entries.map((e) => [e.key, e]));

  await prisma.$transaction(
    [...latest.values()].map((entry) =>
      entry.value === ""
        ? prisma.lessonResponse.deleteMany({ where: { lessonId, userId, fieldKey: entry.key } })
        : prisma.lessonResponse.upsert({
            where: { lessonId_userId_fieldKey: { lessonId, userId, fieldKey: entry.key } },
            create: { lessonId, userId, fieldKey: entry.key, label: entry.label.slice(0, 200), value: entry.value },
            update: { label: entry.label.slice(0, 200), value: entry.value },
          }),
    ),
  );

  return { ok: true };
}
