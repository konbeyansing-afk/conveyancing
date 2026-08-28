import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WORK_STATUS_LABELS, isSameAppDay } from "@/lib/work-status";
import { MATTER_STAGE_LABELS, nextMatterStageLabel } from "@/lib/matter-stage";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/work-status/status-badge";
import { PriorityBadge } from "@/components/work-status/priority-badge";
import { MatterStageBadge } from "@/components/work-status/matter-stage-badge";
import { JurisdictionBadge } from "@/components/work-status/jurisdiction-badge";
import { ConveyancingTimeline } from "@/components/work-status/conveyancing-timeline";
import { ChecklistPanel } from "@/components/work-status/checklist-panel";
import { MatterHealthPanel } from "@/components/work-status/matter-health-panel";
import { WorkItemDetailSheet, type WorkItemDetail } from "@/components/work-status/work-item-detail-sheet";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { loadChecklist } from "@/lib/checklist-data";
import { CheckCircle2, ClipboardList, Hourglass, AlertTriangle } from "lucide-react";

const dateTimeFormat = (d: Date) =>
  d.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function WorkItemRow({
  item,
  canAddAdminNote,
  canEditMatterStage,
}: {
  item: WorkItemDetail;
  canAddAdminNote: boolean;
  canEditMatterStage: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-medium">{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <JurisdictionBadge jurisdiction={item.jurisdiction} className="text-[0.65rem]" />
          <MatterStageBadge stage={item.matterStage} className="px-2 py-0.5 text-[0.65rem]" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.matterReference && <span>Matter #{item.matterReference}</span>}
          <span>Updated {formatRelativeTime(item.updatedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PriorityBadge priority={item.priority} />
        <StatusBadge status={item.status} />
        <WorkItemDetailSheet
          item={item}
          canAddAdminNote={canAddAdminNote}
          canEditMatterStage={canEditMatterStage}
        />
      </div>
    </div>
  );
}

export default async function AdminVaWorkStatusDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const session = await auth();
  const actorRole = session!.user.role;
  const canAddAdminNote = actorRole === "ADMIN";
  // Any Trainer is treated as authorized (see updateMatterStage) — there is
  // no per-trainer VA-assignment scope to check yet.
  const canEditMatterStage = actorRole === "ADMIN" || actorRole === "TRAINER";

  const va = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!va || va.role !== "VA") notFound();

  const items = await prisma.workItem.findMany({
    where: { userId: va.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      activity: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      adminNotes: { orderBy: { createdAt: "desc" }, include: { adminUser: { select: { name: true } } } },
    },
  });

  const detailItems: WorkItemDetail[] = items;
  const now = new Date();

  // A VA can have several matters in progress at once — no one-active-task
  // limit — so this is every in-progress matter, not just one.
  const inProgressItems = detailItems.filter((i) => i.status === "IN_PROGRESS");
  const pendingItems = detailItems.filter((i) => i.status === "NOT_STARTED" || i.status === "WAITING_PENDING");
  const blockedItems = detailItems.filter((i) => i.status === "BLOCKED");
  const completedTodayItems = detailItems.filter(
    (i) => i.status === "COMPLETED" && i.completedAt && isSameAppDay(i.completedAt, now),
  );

  const lastUpdated = detailItems.reduce<Date | null>(
    (latest, i) => (!latest || i.updatedAt > latest ? i.updatedAt : latest),
    null,
  );

  const recentActivity = detailItems
    .flatMap((item) => item.activity.map((entry) => ({ ...entry, itemTitle: item.title })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20);

  const checklists = await Promise.all(
    inProgressItems.map(async (item) => [
      item.id,
      await loadChecklist(item.id, item.jurisdiction, item.matterType, item.matterStage),
    ] as const),
  );
  const checklistByItemId = new Map(checklists);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Work Status", href: "/admin/work-status" }, { label: va.name }]}
        title={va.name}
        description={va.email}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In Progress" value={inProgressItems.length} icon={ClipboardList} />
        <StatCard
          label="Last Update"
          value={lastUpdated ? formatRelativeTime(lastUpdated) : "Never"}
          icon={Hourglass}
        />
        <StatCard label="Completed Today" value={completedTodayItems.length} icon={CheckCircle2} tone="success" />
        <StatCard
          label="Blocked"
          value={blockedItems.length}
          icon={AlertTriangle}
          tone={blockedItems.length > 0 ? "warning" : "default"}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Current Matters</h2>
        {inProgressItems.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nothing marked in progress.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {inProgressItems.map((item) => {
              const checklist = checklistByItemId.get(item.id) ?? { tasks: [], issues: [] };
              return (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                      <span className="truncate">{item.title}</span>
                      <WorkItemDetailSheet
                        item={item}
                        canAddAdminNote={canAddAdminNote}
                        canEditMatterStage={canEditMatterStage}
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <JurisdictionBadge jurisdiction={item.jurisdiction} />
                      <MatterStageBadge stage={item.matterStage} />
                      <PriorityBadge priority={item.priority} />
                    </div>
                    {item.matterReference && (
                      <p className="text-xs text-muted-foreground">Matter #{item.matterReference}</p>
                    )}
                    <ConveyancingTimeline
                      jurisdiction={item.jurisdiction}
                      currentStage={item.matterStage}
                      isWorkBlocked={item.status === "BLOCKED"}
                    />
                    {nextMatterStageLabel(item.jurisdiction, item.matterStage) && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Next Matter Stage:</span>{" "}
                        {nextMatterStageLabel(item.jurisdiction, item.matterStage)}
                      </p>
                    )}
                    <ChecklistPanel
                      workItemId={item.id}
                      jurisdiction={item.jurisdiction}
                      matterStage={item.matterStage}
                      tasks={checklist.tasks}
                      canEdit={canEditMatterStage}
                    />
                    {checklist.tasks.length > 0 && <MatterHealthPanel issues={checklist.issues} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completed Today</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {completedTodayItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing completed today yet.</p>
          ) : (
            completedTodayItems.map((item) => (
              <WorkItemRow
                key={item.id}
                item={item}
                canAddAdminNote={canAddAdminNote}
                canEditMatterStage={canEditMatterStage}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {pendingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending.</p>
          ) : (
            pendingItems.map((item) => (
              <WorkItemRow
                key={item.id}
                item={item}
                canAddAdminNote={canAddAdminNote}
                canEditMatterStage={canEditMatterStage}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blocked / Needs Attention</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {blockedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing blocked.</p>
          ) : (
            blockedItems.map((item) => (
              <WorkItemRow
                key={item.id}
                item={item}
                canAddAdminNote={canAddAdminNote}
                canEditMatterStage={canEditMatterStage}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="grid gap-2">
              {recentActivity.map((entry) => {
                const stageChanged = entry.newMatterStage && entry.previousMatterStage !== entry.newMatterStage;
                const statusChanged = entry.previousStatus && entry.previousStatus !== entry.newStatus;
                return (
                  <li key={entry.id} className="border-l-2 pl-3 text-sm">
                    <p className="text-xs text-muted-foreground">{dateTimeFormat(entry.createdAt)}</p>
                    <p>
                      <span className="font-medium">{entry.itemTitle}</span>
                      {stageChanged && (
                        <>
                          {" — Matter Stage: "}
                          {entry.previousMatterStage && `${MATTER_STAGE_LABELS[entry.previousMatterStage]} → `}
                          {MATTER_STAGE_LABELS[entry.newMatterStage!]}
                        </>
                      )}
                      {statusChanged && (
                        <>
                          {" — "}
                          {WORK_STATUS_LABELS[entry.previousStatus!]} → {WORK_STATUS_LABELS[entry.newStatus]}
                        </>
                      )}
                      {!stageChanged && !statusChanged && " — note added"}
                    </p>
                    {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
