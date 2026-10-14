import { AlertTriangle, PenLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type LessonResponseRow = {
  fieldKey: string;
  label: string;
  value: string;
  updatedAt: Date;
  /** Heading of the section the answer was written in, snapshotted when it was saved. */
  section: string | null;
  position: number | null;
  needsReview: boolean;
  reviewNote: string | null;
};

const KIND_ORDER: Record<string, number> = { blank: 0, cell: 1, box: 2, ans: 3 };

/** Rows saved before stable keys carry their position in the key; used only to order and title them. */
function legacyParts(key: string) {
  const match = /^s(\d+)-(cell|blank|box|ans)-(\d+)$/.exec(key);
  return match ? { step: Number(match[1]), kind: match[2], n: Number(match[3]) } : null;
}

function describe(value: string) {
  return value === "checked" ? "✓ Ticked" : value;
}

/**
 * What a trainee typed into a lesson's fill-in fields, grouped by the section
 * it was written in. Read-only — it is the trainer's record of the trainee's own
 * words. The section comes from the heading saved with each answer, never from
 * where that question sits in the lesson today, so editing the lesson cannot
 * re-label an answer; anything that could not be matched to a question with
 * certainty is shown separately, with its original wording.
 */
export function LessonResponsesCard({
  traineeName,
  rows,
  stepTitles,
}: {
  traineeName: string;
  rows: LessonResponseRow[];
  stepTitles: string[];
}) {
  const flagged = rows.filter((r) => r.needsReview);
  const placed = rows.filter((r) => !r.needsReview);

  const sectionOf = (row: LessonResponseRow) => {
    if (row.section) return row.section;
    const legacy = legacyParts(row.fieldKey);
    return (legacy && stepTitles[legacy.step]) || (legacy ? `Section ${legacy.step + 1}` : "Other answers");
  };
  const orderInSection = (row: LessonResponseRow) => {
    if (row.position !== null) return row.position;
    const legacy = legacyParts(row.fieldKey);
    return legacy ? KIND_ORDER[legacy.kind] * 1000 + legacy.n : 0;
  };

  const groups = new Map<string, LessonResponseRow[]>();
  for (const row of placed) groups.set(sectionOf(row), [...(groups.get(sectionOf(row)) ?? []), row]);
  const sections = [...groups.entries()].sort(([a], [b]) => {
    const x = stepTitles.indexOf(a);
    const y = stepTitles.indexOf(b);
    return (x === -1 ? Infinity : x) - (y === -1 ? Infinity : y) || a.localeCompare(b);
  });

  const lastUpdated = rows.reduce<Date | null>((latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest), null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PenLine className="size-4 text-primary" />
          What {traineeName} wrote
        </CardTitle>
        {lastUpdated && <p className="text-xs text-muted-foreground">Last updated {formatRelativeTime(lastUpdated)}</p>}
      </CardHeader>
      <CardContent className="grid gap-5">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No written answers saved for this lesson yet. Anything {traineeName} types into its fill-in fields will appear
            here.
          </p>
        )}

        {flagged.length > 0 && (
          <section className="grid gap-2 rounded-lg border border-warning/40 bg-warning/[0.06] p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-warning" />
              Needs review — can&apos;t be matched to a question with certainty
            </h3>
            <p className="text-xs text-muted-foreground">
              The lesson was edited after these were written. They are kept exactly as {traineeName} wrote them, with the
              wording of the question at the time.
            </p>
            <dl className="grid gap-2">
              {flagged.map((item) => (
                <div key={item.fieldKey} className="rounded-lg border bg-background px-3 py-2">
                  <dt className="text-xs text-muted-foreground">
                    {item.section ? `${item.section} — ` : ""}
                    {item.label || "Answer"}
                  </dt>
                  <dd className="mt-0.5 text-sm whitespace-pre-wrap">{describe(item.value)}</dd>
                  {item.reviewNote && <p className="mt-1 text-xs text-muted-foreground">{item.reviewNote}</p>}
                </div>
              ))}
            </dl>
          </section>
        )}

        {sections.map(([title, items]) => (
          <section key={title} className="grid gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <dl className="grid gap-2">
              {[...items]
                .sort((a, b) => orderInSection(a) - orderInSection(b))
                .map((item) => (
                  <div key={item.fieldKey} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{item.label || "Answer"}</dt>
                    <dd className="mt-0.5 text-sm whitespace-pre-wrap">{describe(item.value)}</dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
