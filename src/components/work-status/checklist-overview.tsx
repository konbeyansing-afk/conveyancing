import { AlertTriangle, CalendarClock, CheckCircle2, Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type OverviewTaskEntry = {
  key: string;
  title: string;
  matterTitle: string;
  when: Date;
};

/**
 * Today's Tasks / Overdue Tasks / Upcoming Critical Dates / Blocked Tasks /
 * Recently Completed (spec section 10) — checklist tasks rolled up across
 * every one of the VA's own matters, not just the one currently spotlighted,
 * since a due date or a blocker doesn't stop mattering just because a
 * different matter is In Progress right now.
 */
export function ChecklistOverview({
  overdue,
  dueToday,
  blocked,
  recentlyCompleted,
}: {
  overdue: OverviewTaskEntry[];
  dueToday: OverviewTaskEntry[];
  blocked: OverviewTaskEntry[];
  recentlyCompleted: OverviewTaskEntry[];
}) {
  if (overdue.length === 0 && dueToday.length === 0 && blocked.length === 0 && recentlyCompleted.length === 0) {
    return null;
  }

  type Group = { label: string; icon: typeof AlertTriangle; tone: string; entries: OverviewTaskEntry[]; whenLabel: (d: Date) => string };
  const groups: Group[] = [
    { label: "Overdue Tasks", icon: AlertTriangle, tone: "text-destructive", entries: overdue, whenLabel: (d: Date) => `Due ${formatRelativeTime(d)}` },
    { label: "Upcoming Critical Dates", icon: CalendarClock, tone: "text-warning", entries: dueToday, whenLabel: (d: Date) => `Due ${formatRelativeTime(d)}` },
    { label: "Blocked Tasks", icon: Hourglass, tone: "text-destructive", entries: blocked, whenLabel: (d: Date) => `Since ${formatRelativeTime(d)}` },
    { label: "Recently Completed", icon: CheckCircle2, tone: "text-success", entries: recentlyCompleted, whenLabel: (d: Date) => formatRelativeTime(d) },
  ].filter((g) => g.entries.length > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {groups.map((group) => (
        <Card key={group.label}>
          <CardHeader className="pb-2">
            <CardTitle className={`flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase ${group.tone}`}>
              <group.icon className="size-3.5" />
              {group.label} ({group.entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {group.entries.slice(0, 5).map((entry) => (
              <div key={entry.key} className="text-xs">
                <p className="truncate font-medium">{entry.title}</p>
                <p className="truncate text-muted-foreground">
                  {entry.matterTitle} · {group.whenLabel(entry.when)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
