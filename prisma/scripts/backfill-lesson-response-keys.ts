/**
 * Re-keys trainee answers saved under the old positional keys ("s3-cell-2") to
 * their stable field identity, without ever losing or reassigning one.
 *
 *   Dry run (default; read-only):  npx tsx prisma/scripts/backfill-lesson-response-keys.ts
 *   Apply:                         npx tsx prisma/scripts/backfill-lesson-response-keys.ts --apply --backup=<file.json>
 *
 * Rules:
 *  - An answer is re-keyed only when it can be placed with certainty: the lesson
 *    has not been edited since the answer was first saved, or the question's
 *    stored wording still matches the field at that position and is unique in
 *    its section. Anything else is kept exactly as it is and flagged
 *    (needsReview) for a human, never guessed.
 *  - Nothing is deleted. A re-keyed row is the same record: value, label and
 *    timestamps are untouched and the old key is kept in legacyKey.
 *  - --apply writes a full JSON backup first, reads it back, and aborts if it
 *    cannot be verified. After applying it re-reads every row and checks that
 *    none were lost and no value changed.
 *  - Idempotent: rows already on a stable key are skipped.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { Window } from "happy-dom";
import ws from "ws";
import { lessonContentToHtml } from "@/components/lesson-content/lesson-content-html";
import { splitIntoSteps } from "@/lib/tiptap/split-into-steps";
import { STABLE_KEY, isAnswerStep, isTraineeFillableStep, makeFieldsFillable, type FieldDescriptor } from "@/lib/lesson-fields";

try {
  process.loadEnvFile(".env");
} catch {
  // rely on already-set environment variables
}

neonConfig.webSocketConstructor = ws;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

const APPLY = process.argv.includes("--apply");
const backupArg = process.argv.find((a) => a.startsWith("--backup="))?.slice("--backup=".length);

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows() {
  return prisma.lessonResponse.findMany({
    orderBy: [{ lessonId: "asc" }, { userId: "asc" }, { fieldKey: "asc" }],
    include: { lesson: { select: { title: true, updatedAt: true, content: true } }, user: { select: { name: true } } },
  });
}

/** The fields a trainee actually sees in a lesson today, exactly as the viewer builds them. */
function currentFields(content: unknown): FieldDescriptor[] {
  const window = new Window();
  const out: FieldDescriptor[] = [];
  const steps = splitIntoSteps(content as never);
  steps.forEach((step, index) => {
    if (!isTraineeFillableStep(step.title)) return;
    const container = window.document.createElement("div") as unknown as HTMLElement;
    container.innerHTML = lessonContentToHtml(step.content);
    const stepOccurrence = steps.slice(0, index).filter((s) => s.title === step.title).length;
    out.push(
      ...makeFieldsFillable(container, {
        stepIndex: index,
        stepTitle: step.title,
        stepOccurrence,
        answerStep: isAnswerStep(step.title),
        saved: {},
        onChange: () => {},
      }),
    );
  });
  return out;
}

type Plan =
  | { kind: "move"; row: Row; field: FieldDescriptor; evidence: string }
  | { kind: "flag"; row: Row; reason: string };

function plan(rows: Row[]): { plans: Plan[]; placed: number; alreadyStable: number } {
  const plans: Plan[] = [];
  let alreadyStable = 0;
  const fieldsByLesson = new Map<string, FieldDescriptor[]>();
  const claimed = new Set<string>(rows.filter((r) => STABLE_KEY.test(r.fieldKey)).map((r) => `${r.lessonId}|${r.userId}|${r.fieldKey}`));

  for (const row of rows) {
    if (STABLE_KEY.test(row.fieldKey) || row.fieldId) {
      alreadyStable++;
      continue;
    }
    if (!fieldsByLesson.has(row.lessonId)) fieldsByLesson.set(row.lessonId, currentFields(row.lesson.content));
    const fields = fieldsByLesson.get(row.lessonId)!;
    const field = fields.find((f) => f.legacyKey === row.fieldKey);

    if (!field) {
      plans.push({ kind: "flag", row, reason: "No fill-in field exists at this position in the lesson any more." });
      continue;
    }

    const untouched = row.lesson.updatedAt <= row.createdAt;
    const sameWording = field.label === row.label;
    const unique = fields.filter((f) => f.section === field.section && f.kind === field.kind && f.label === field.label).length === 1;
    const claimKey = `${row.lessonId}|${row.userId}|${field.key}`;

    if (!(untouched || (sameWording && unique))) {
      plans.push({
        kind: "flag",
        row,
        reason: `The lesson was edited after this was saved and the question now at this position reads "${field.label}", not "${row.label}".`,
      });
    } else if (claimed.has(claimKey)) {
      plans.push({ kind: "flag", row, reason: "The question's stable key is already used by another saved answer." });
    } else {
      claimed.add(claimKey);
      plans.push({
        kind: "move",
        row,
        field,
        evidence: untouched ? "lesson unchanged since answer saved" : "stored wording matches and is unique",
      });
    }
  }

  const placed = plans.filter((p) => p.kind === "move").length;
  return { plans, placed, alreadyStable };
}

const snapshot = (r: Row) => ({
  id: r.id,
  lessonId: r.lessonId,
  userId: r.userId,
  fieldKey: r.fieldKey,
  fieldId: r.fieldId,
  legacyKey: r.legacyKey,
  section: r.section,
  position: r.position,
  label: r.label,
  value: r.value,
  needsReview: r.needsReview,
  reviewNote: r.reviewNote,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

async function main() {
  const rows = await loadRows();
  console.log(`${rows.length} saved answer(s) across ${new Set(rows.map((r) => r.lessonId)).size} lesson(s)\n`);

  const { plans, placed, alreadyStable } = plan(rows);
  const flags = plans.filter((p): p is Extract<Plan, { kind: "flag" }> => p.kind === "flag");

  const byLesson = new Map<string, { title: string; move: number; flag: number }>();
  for (const p of plans) {
    const entry = byLesson.get(p.row.lessonId) ?? { title: p.row.lesson.title, move: 0, flag: 0 };
    if (p.kind === "move") entry.move++;
    else entry.flag++;
    byLesson.set(p.row.lessonId, entry);
  }
  for (const e of byLesson.values()) console.log(`  ${e.title.padEnd(32)} will re-key ${e.move}, flag ${e.flag}`);
  console.log(`\nalready on a stable key: ${alreadyStable}   will re-key: ${placed}   will flag for review: ${flags.length}`);
  for (const f of flags) console.log(`  FLAG ${f.row.user.name} / ${f.row.lesson.title} / ${f.row.fieldKey}: ${f.reason}`);

  if (!APPLY) {
    console.log("\nDry run only — nothing was changed. Re-run with --apply --backup=<file.json> to apply.");
    return;
  }

  if (!backupArg) throw new Error("--apply requires --backup=<path to a .json file outside the repository>");

  // 1. Backup, read back and verified before anything is touched.
  const payload = JSON.stringify({ takenAt: new Date().toISOString(), count: rows.length, rows: rows.map(snapshot) });
  const digest = createHash("sha256").update(payload).digest("hex");
  mkdirSync(dirname(backupArg), { recursive: true });
  writeFileSync(backupArg, payload);
  const readBack = createHash("sha256").update(readFileSync(backupArg, "utf-8")).digest("hex");
  if (readBack !== digest) throw new Error("Backup could not be verified — aborting before any change.");
  console.log(`\nBackup written and verified: ${backupArg}\n  rows=${rows.length} sha256=${digest}`);

  // 2. Apply. Each change is an in-place update of the same record; no row is created or removed.
  for (const p of plans) {
    if (p.kind === "move") {
      await prisma.lessonResponse.update({
        where: { id: p.row.id },
        data: {
          fieldKey: p.field.key,
          fieldId: p.field.key.slice(2),
          legacyKey: p.row.fieldKey,
          section: p.field.section,
          position: p.field.position,
          needsReview: false,
          reviewNote: null,
        },
      });
    } else {
      await prisma.lessonResponse.update({
        where: { id: p.row.id },
        data: { needsReview: true, reviewNote: p.reason },
      });
    }
  }

  // 3. Verify: nothing lost, nothing's content changed, every re-keyed row is findable.
  const after = await loadRows();
  const before = new Map(rows.map((r) => [r.id, r]));
  const problems: string[] = [];
  if (after.length !== rows.length) problems.push(`row count ${rows.length} -> ${after.length}`);
  for (const r of after) {
    const b = before.get(r.id);
    if (!b) {
      problems.push(`unexpected new row ${r.id}`);
      continue;
    }
    if (b.value !== r.value || b.label !== r.label || b.userId !== r.userId || b.lessonId !== r.lessonId) {
      problems.push(`row ${r.id} content changed`);
    }
  }
  for (const id of before.keys()) if (!after.some((r) => r.id === id)) problems.push(`row ${id} is missing`);

  const fieldsByLesson = new Map<string, FieldDescriptor[]>();
  let findable = 0;
  for (const r of after.filter((x) => !x.needsReview)) {
    if (!fieldsByLesson.has(r.lessonId)) fieldsByLesson.set(r.lessonId, currentFields(r.lesson.content));
    if (fieldsByLesson.get(r.lessonId)!.some((f) => f.key === r.fieldKey)) findable++;
    else problems.push(`row ${r.id} (${r.fieldKey}) has no matching field`);
  }
  console.log(
    `\nVerification: ${problems.length === 0 ? "PASS" : "FAIL"} — ${after.length}/${rows.length} rows present, ` +
      `values unchanged, ${findable} placed on a current question, ${after.filter((r) => r.needsReview).length} flagged`,
  );
  for (const p of problems) console.log("  PROBLEM:", p);
  if (problems.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
