"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished } from "@/lib/stage-access";
import { LEGACY_KEY, MAX_RESPONSE_LENGTH, STABLE_KEY } from "@/lib/lesson-fields";

export type SaveLessonResponsesResult = { ok: boolean; error?: string };

export type SaveEntry = {
  /** Stable field identity ("f-<hash>"); the positional legacy format is still accepted. */
  key: string;
  /** Present only when this save adopts an answer stored under the old positional key. */
  legacyKey?: string;
  label: string;
  section?: string;
  position?: number;
  value: string;
};

const MAX_BATCH = 100;

/**
 * Saves what a trainee typed into a lesson's fill-in fields. Always writes to
 * the signed-in user's own rows — there is no way to name another user — and
 * applies the same access rules as completing the lesson, so a trainee can't
 * store answers against a lesson they couldn't open. An empty value removes
 * the row rather than keeping a blank one.
 *
 * Re-keying never loses an answer: when an edit adopts a legacy positional row,
 * that row is renamed in place (same record, same history) to the stable key.
 */
export async function saveLessonResponses(lessonId: string, entries: SaveEntry[]): Promise<SaveLessonResponsesResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Please sign in again." };

  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_BATCH) {
    return { ok: false, error: "Nothing to save." };
  }
  for (const entry of entries) {
    const keyOk = typeof entry.key === "string" && (STABLE_KEY.test(entry.key) || LEGACY_KEY.test(entry.key));
    const legacyOk =
      entry.legacyKey === undefined || (typeof entry.legacyKey === "string" && LEGACY_KEY.test(entry.legacyKey));
    if (!keyOk || !legacyOk) return { ok: false, error: "Invalid field." };
    if (typeof entry.value !== "string" || typeof entry.label !== "string") return { ok: false, error: "Invalid field." };
    if (entry.section !== undefined && typeof entry.section !== "string") return { ok: false, error: "Invalid field." };
    if (entry.position !== undefined && !Number.isInteger(entry.position)) return { ok: false, error: "Invalid field." };
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

  for (const entry of latest.values()) {
    const label = entry.label.slice(0, 200);
    const section = entry.section?.slice(0, 200) ?? null;
    const fieldId = STABLE_KEY.test(entry.key) ? entry.key.slice(2) : null;

    if (entry.value === "") {
      // The trainee cleared the field: remove the row they own for it, under either key.
      await prisma.lessonResponse.deleteMany({
        where: {
          lessonId,
          userId,
          fieldKey: { in: entry.legacyKey ? [entry.key, entry.legacyKey] : [entry.key] },
        },
      });
      continue;
    }

    if (entry.legacyKey) {
      const alreadyKeyed = await prisma.lessonResponse.findUnique({
        where: { lessonId_userId_fieldKey: { lessonId, userId, fieldKey: entry.key } },
        select: { id: true },
      });
      if (!alreadyKeyed) {
        const moved = await prisma.lessonResponse.updateMany({
          where: { lessonId, userId, fieldKey: entry.legacyKey },
          data: {
            fieldKey: entry.key,
            fieldId,
            legacyKey: entry.legacyKey,
            section,
            position: entry.position ?? null,
            value: entry.value,
            needsReview: false,
            reviewNote: null,
          },
        });
        if (moved.count > 0) continue;
      }
    }

    await prisma.lessonResponse.upsert({
      where: { lessonId_userId_fieldKey: { lessonId, userId, fieldKey: entry.key } },
      create: {
        lessonId,
        userId,
        fieldKey: entry.key,
        fieldId,
        section,
        position: entry.position ?? null,
        label,
        value: entry.value,
      },
      update: { value: entry.value, label, section, position: entry.position ?? null },
    });
  }

  return { ok: true };
}
