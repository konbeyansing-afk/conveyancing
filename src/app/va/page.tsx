import { AlertTriangle, CheckCircle2, Hourglass, ListTodo } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeDailySummary, isSameAppDay, pickRepresentativeItem } from "@/lib/work-status";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { CurrentTaskCard } from "@/components/work-status/current-task-card";
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

  // In progress wins; otherwise the most recently touched blocker stays the
  // spotlighted "current" item (it's still what the VA is dealing with) —
  // but a queued Not Started/Waiting item does not, so it stays in Pending.
  const currentItem = pickRepresentativeItem(items, { includeQueued: false });

  const now = new Date();
  const activityToday = items.flatMap((i) => i.activity).filter((a) => isSameAppDay(a.createdAt, now));
  const summary = computeDailySummary(items, activityToday, now);

  const detailItems: WorkItemDetail[] = items;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Good morning, ${firstName}`}
        description="Tell Admin what you're working on right now."
        actions={<UpdateWorkStatusDialog />}
      />

      <CurrentTaskCard item={currentItem} />

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
        <MyWorkTabs items={detailItems} featuredId={currentItem?.id} />
      </div>
    </div>
  );
}
