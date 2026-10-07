import { PenLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type LessonResponseRow = { fieldKey: string; label: string; value: string; updatedAt: Date };

const KIND_ORDER: Record<string, number> = { blank: 0, cell: 1, box: 2 };

function parseKey(key: string) {
  const match = /^s(\d+)-(cell|blank|box)-(\d+)$/.exec(key);
  return match ? { step: Number(match[1]), kind: match[2], n: Number(match[3]) } : { step: 0, kind: "blank", n: 0 };
}

/**
 * What a trainee typed into a lesson's fill-in fields, grouped by the section
 * it was in. Read-only — it is the trainer's record of the trainee's own words.
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
  const groups = new Map<number, LessonResponseRow[]>();
  for (const row of [...rows].sort((a, b) => {
    const x = parseKey(a.fieldKey);
    const y = parseKey(b.fieldKey);
    return x.step - y.step || KIND_ORDER[x.kind] - KIND_ORDER[y.kind] || x.n - y.n;
  })) {
    const step = parseKey(row.fieldKey).step;
    groups.set(step, [...(groups.get(step) ?? []), row]);
  }
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
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No written answers saved for this lesson yet. Anything {traineeName} types into its fill-in fields will appear here.
          </p>
        ) : (
          [...groups.entries()].map(([step, items]) => (
            <section key={step} className="grid gap-2">
              <h3 className="text-sm font-semibold">{stepTitles[step] ?? `Section ${step + 1}`}</h3>
              <dl className="grid gap-2">
                {items.map((item) => (
                  <div key={item.fieldKey} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{item.label || "Answer"}</dt>
                    <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                      {item.value === "checked" ? "✓ Ticked" : item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
