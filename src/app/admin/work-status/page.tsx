import { AlertTriangle, CheckCircle2, ClipboardList, Hourglass, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  classifyVaState,
  hasNoRecentUpdate,
  isSameAppDay,
  pickRepresentativeItem,
} from "@/lib/work-status";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VaStatusTable, type VaSummary } from "@/components/admin/work-status/va-status-table";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { hasChecklistTemplate } from "@/lib/checklist-templates";
import { loadChecklist } from "@/lib/checklist-data";

export default async function AdminWorkStatusPage() {
  const [vas, items] = await Promise.all([
    prisma.user.findMany({
      where: { role: "VA" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.workItem.findMany({
      where: { deletedAt: null, user: { role: "VA" } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        title: true,
        matterReference: true,
        notes: true,
        jurisdiction: true,
        matterType: true,
        matterStage: true,
        status: true,
        priority: true,
        updatedAt: true,
        completedAt: true,
      },
    }),
  ]);

  const now = new Date();
  const itemsByVa = new Map<string, typeof items>();
  for (const item of items) {
    if (!itemsByVa.has(item.userId)) itemsByVa.set(item.userId, []);
    itemsByVa.get(item.userId)!.push(item);
  }

  let working = 0;
  let pending = 0;
  let blocked = 0;
  let updatedTodayCount = 0;

  const summaries: VaSummary[] = await Promise.all(
    vas.map(async (va) => {
      const vaItems = itemsByVa.get(va.id) ?? [];
      const state = classifyVaState(vaItems);
      if (state === "working") working++;
      if (state === "pending") pending++;
      if (state === "blocked") blocked++;

      const representative = pickRepresentativeItem(vaItems);
      const lastUpdated = vaItems.reduce<Date | null>(
        (latest, i) => (!latest || i.updatedAt > latest ? i.updatedAt : latest),
        null,
      );
      if (lastUpdated && isSameAppDay(lastUpdated, now)) updatedTodayCount++;

      const completedToday = vaItems.filter(
        (i) => i.status === "COMPLETED" && i.completedAt && isSameAppDay(i.completedAt, now),
      ).length;

      // Checklist Progress (spec section 12): computed live from the
      // representative matter's actual task records, not a stored/faked
      // number — null when there's no matter, or no checklist template for
      // its jurisdiction/matter type yet (e.g. NSW before it shipped).
      let checklistProgress: number | null = null;
      let blockedTaskCount = 0;
      if (representative && hasChecklistTemplate(representative.jurisdiction, representative.matterType)) {
        const checklist = await loadChecklist(
          representative.id,
          representative.jurisdiction,
          representative.matterType,
          representative.matterStage,
        );
        const total = checklist.tasks.length;
        const done = checklist.tasks.filter((t) => t.status === "COMPLETED" || t.status === "NOT_APPLICABLE").length;
        checklistProgress = total === 0 ? null : Math.round((done / total) * 100);
        blockedTaskCount = checklist.tasks.filter((t) => t.status === "BLOCKED").length;
      }

      return {
        id: va.id,
        name: va.name,
        email: va.email,
        currentTask: representative?.title ?? null,
        currentMatter: representative?.matterReference ?? null,
        jurisdiction: representative?.jurisdiction ?? null,
        matterStage: representative?.matterStage ?? null,
        status: representative?.status ?? null,
        priority: representative?.priority ?? null,
        lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        completedToday,
        checklistProgress,
        blockedTaskCount,
        searchText: vaItems.map((i) => `${i.title} ${i.matterReference ?? ""} ${i.notes ?? ""}`).join(" "),
      };
    }),
  );

  const completedTodayTotal = items.filter(
    (i) => i.status === "COMPLETED" && i.completedAt && isSameAppDay(i.completedAt, now),
  ).length;

  const noRecentUpdate = summaries
    .filter((s) => hasNoRecentUpdate(s.lastUpdated ? new Date(s.lastUpdated) : null, now))
    .sort((a, b) => (a.lastUpdated ?? "").localeCompare(b.lastUpdated ?? ""));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Work Status"
        description="What every VA is working on, what's done, and what needs attention — a visibility tool, not a scorecard."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total VAs" value={vas.length} icon={Users} />
        <StatCard label="Working" value={working} icon={ClipboardList} tone="success" />
        <StatCard label="Pending" value={pending} icon={Hourglass} />
        <StatCard label="Blocked" value={blocked} icon={AlertTriangle} tone={blocked > 0 ? "warning" : "default"} />
        <StatCard label="Completed Today" value={completedTodayTotal} icon={CheckCircle2} tone="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Activity Today</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {vas.length} VA{vas.length === 1 ? "" : "s"} · {updatedTodayCount} updated today ·{" "}
            {working} currently working · {pending} pending · {blocked} blocked ·{" "}
            {completedTodayTotal} task{completedTodayTotal === 1 ? "" : "s"} completed
          </p>

          {noRecentUpdate.length > 0 && (
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">No Recent Update</p>
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {noRecentUpdate.map((va) => (
                  <li key={va.id} className="rounded-lg border px-3 py-2 text-sm">
                    <p className="font-medium">{va.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {va.lastUpdated
                        ? `Last update ${formatRelativeTime(new Date(va.lastUpdated))}`
                        : "No updates yet"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {vas.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No VAs yet"
          description="Create a VA account from the Users page to start tracking work status."
        />
      ) : (
        <VaStatusTable vas={summaries} />
      )}
    </div>
  );
}
