import { AlertTriangle, CheckCircle2, ClipboardList, Hourglass, ListTodo } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeDailySummary, isSameAppDay, pickCurrentItems } from "@/lib/work-status";
import { isTaskDone } from "@/lib/checklist";
import { loadChecklist } from "@/lib/checklist-data";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { CurrentTaskCard } from "@/components/work-status/current-task-card";
import { ChecklistOverview, type OverviewTaskEntry } from "@/components/work-status/checklist-overview";
import { UpdateWorkStatusDialog } from "@/components/work-status/update-status-dialog";
import { MyWorkTabs } from "@/components/work-status/my-work-tabs";
import type { WorkItemDetail } from "@/components/work-status/work-item-detail-sheet";

const timeFormat = (d: Date) =>
  d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });

export default async function VaWorkStatusPage() {
  const session = await auth();
  const userId = session!.user.id;
  const firstName = (session!.user.name ?? "there").split(" ")[0];

  const items = await prisma.workItem.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      activity: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      adminNotes: { orderBy: { createdAt: "desc" }, include: { adminUser: { select: { name: true } } } },
    },
  });

  // Every in-progress matter is spotlighted here — a VA can have several
  // open at once. With nothing in progress, their blockers still surface
  // (they're still dealing with those); a queued Not Started/Waiting item
  // does not, so it stays in Pending rather than the hero cards.
  const currentItems = pickCurrentItems(items);
  const currentIds = new Set(currentItems.map((i) => i.id));

  const now = new Date();
  const activityToday = items.flatMap((i) => i.activity).filter((a) => isSameAppDay(a.createdAt, now));
  const summary = computeDailySummary(items, activityToday, now);

  const detailItems: WorkItemDetail[] = items;

  // Loaded for every open matter, not just the spotlighted ones: the
  // Overdue/Due Today/Blocked/Recently Completed rollup below spans all of
  // the VA's own work, and each spotlighted card needs its own checklist.
  const checklists = await Promise.all(
    items
      .filter((i) => i.status !== "COMPLETED")
      .map(async (item) => ({
        item,
        checklist: await loadChecklist(item.id, item.jurisdiction, item.matterType, item.matterStage),
      })),
  );
  const checklistByItemId = new Map(checklists.map((c) => [c.item.id, c.checklist]));

  const overdue: OverviewTaskEntry[] = [];
  const dueToday: OverviewTaskEntry[] = [];
  const blocked: OverviewTaskEntry[] = [];
  for (const { item, checklist } of checklists) {
    for (const task of checklist.tasks) {
      if (task.status === "BLOCKED") {
        blocked.push({ key: task.id, title: task.title, matterTitle: item.title, when: task.updatedAt ?? now });
      }
      if (task.dueDate && !isTaskDone(task.status)) {
        const entry: OverviewTaskEntry = { key: task.id, title: task.title, matterTitle: item.title, when: task.dueDate };
        if (task.dueDate.getTime() < now.getTime()) overdue.push(entry);
        else if (isSameAppDay(task.dueDate, now)) dueToday.push(entry);
      }
    }
  }
  const recentlyCompleted: OverviewTaskEntry[] = checklists
    .flatMap(({ item, checklist }) =>
      checklist.tasks
        .filter((t) => t.status === "COMPLETED" && t.completedAt)
        .map((t) => ({ key: t.id, title: t.title, matterTitle: item.title, when: t.completedAt as Date })),
    )
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 5);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Good morning, ${firstName}`}
        description="Tell Admin what you're working on right now."
        actions={<UpdateWorkStatusDialog />}
      />

      {currentItems.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing marked in progress"
          description="Use “+ Update Work Status” below to tell Admin what you're working on."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {currentItems.map((item) => (
            <CurrentTaskCard
              key={item.id}
              item={item}
              checklist={checklistByItemId.get(item.id) ?? { tasks: [], issues: [] }}
            />
          ))}
        </div>
      )}

      <ChecklistOverview overdue={overdue} dueToday={dueToday} blocked={blocked} recentlyCompleted={recentlyCompleted} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Today</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Completed" value={summary.completed} icon={CheckCircle2} tone="success" />
          <StatCard label="In Progress" value={summary.inProgress} icon={ListTodo} />
          <StatCard label="Pending" value={summary.pending} icon={Hourglass} />
          <StatCard
            label="Blocked"
            value={summary.blocked}
            icon={AlertTriangle}
            tone={summary.blocked > 0 ? "warning" : "default"}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {summary.totalUpdates} update{summary.totalUpdates === 1 ? "" : "s"} today
          {summary.firstUpdateAt && ` · first ${timeFormat(summary.firstUpdateAt)}`}
          {summary.lastUpdateAt && ` · last ${timeFormat(summary.lastUpdateAt)}`}
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">My Work</h2>
        <MyWorkTabs items={detailItems} featuredIds={currentIds} canEditMatterStage />
      </div>
    </div>
  );
}
