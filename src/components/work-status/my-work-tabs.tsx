"use client";

import { useMemo, useState } from "react";
import { ListChecks, Play } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/work-status/status-badge";
import { PriorityBadge } from "@/components/work-status/priority-badge";
import { MatterStageBadge } from "@/components/work-status/matter-stage-badge";
import { WorkItemDetailSheet, type WorkItemDetail } from "@/components/work-status/work-item-detail-sheet";
import { QuickStatusButton, ResumeWorkDialog } from "@/components/work-status/quick-actions";
import { Tabs, TabsIndicator, TabsList, TabsTab } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { JURISDICTION_LABELS, JURISDICTION_VALUES, MATTER_STAGE_LABELS, matterWorkflow } from "@/lib/matter-stage";
import { WORK_PRIORITY_LABELS, WORK_PRIORITY_VALUES } from "@/lib/work-status";
import type { Jurisdiction, MatterStage, WorkPriority, WorkStatus } from "@prisma/client";

type FilterTab = "in-progress" | "pending" | "blocked" | "completed";

const TABS: { value: FilterTab; label: string; statuses: WorkStatus[] }[] = [
  { value: "in-progress", label: "In Progress", statuses: ["IN_PROGRESS"] },
  { value: "pending", label: "Pending", statuses: ["NOT_STARTED", "WAITING_PENDING"] },
  { value: "blocked", label: "Blocked", statuses: ["BLOCKED"] },
  { value: "completed", label: "Completed", statuses: ["COMPLETED"] },
];

/**
 * `isFeatured` items already have their quick actions in the Currently
 * Working On card above (spec section 3) — this row skips duplicating them
 * and only offers View. Every other row gets a status-appropriate action so
 * a VA is never stuck with a blocker or a queued task they can only look at
 * (spec section 17): Blocked gets Resolve Blocker, Not Started/Waiting gets
 * Start, Completed gets View only.
 */
function WorkItemRow({ item, isFeatured }: { item: WorkItemDetail; isFeatured: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-medium">{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <MatterStageBadge stage={item.matterStage} className="px-2 py-0.5 text-[0.65rem]" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.matterReference && <span>Matter #{item.matterReference}</span>}
          <span>{JURISDICTION_LABELS[item.jurisdiction]}</span>
          <span>Updated {formatRelativeTime(item.updatedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <PriorityBadge priority={item.priority} />
        <StatusBadge status={item.status} />
        {!isFeatured && item.status === "BLOCKED" && (
          <ResumeWorkDialog
            workItemId={item.id}
            triggerLabel="Resolve Blocker"
            dialogTitle="Resolve blocker"
            notePlaceholder="What changed?"
          />
        )}
        {!isFeatured && (item.status === "NOT_STARTED" || item.status === "WAITING_PENDING") && (
          <QuickStatusButton
            workItemId={item.id}
            newStatus="IN_PROGRESS"
            label="Start"
            icon={<Play className="size-3.5" />}
          />
        )}
        <WorkItemDetailSheet item={item} />
      </div>
    </div>
  );
}

/**
 * Spec sections 6-7 & 11: Work Status stays the primary grouping (In
 * Progress / Pending / Blocked / Completed), with Jurisdiction, Matter
 * Stage and Priority as combinable filters on top — "QLD + Pre-Settlement",
 * "NSW + Blocked", etc. Sorting is always by most recently updated.
 */
export function MyWorkTabs({ items, featuredId }: { items: WorkItemDetail[]; featuredId?: string }) {
  const [tab, setTab] = useState<FilterTab>("in-progress");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<Jurisdiction | "ALL">("ALL");
  const [stageFilter, setStageFilter] = useState<MatterStage | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<WorkPriority | "ALL">("ALL");

  const stageOptions = useMemo(() => {
    if (jurisdictionFilter === "ALL") {
      return Array.from(new Set([...matterWorkflow("QLD"), ...matterWorkflow("NSW")]));
    }
    return matterWorkflow(jurisdictionFilter);
  }, [jurisdictionFilter]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (jurisdictionFilter !== "ALL" && i.jurisdiction !== jurisdictionFilter) return false;
      if (stageFilter !== "ALL" && i.matterStage !== stageFilter) return false;
      if (priorityFilter !== "ALL" && i.priority !== priorityFilter) return false;
      return true;
    });
  }, [items, jurisdictionFilter, stageFilter, priorityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<FilterTab, WorkItemDetail[]>();
    for (const t of TABS) {
      map.set(
        t.value,
        filtered
          .filter((i) => t.statuses.includes(i.status))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      );
    }
    return map;
  }, [filtered]);

  const visible = grouped.get(tab) ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border">
          <button
            type="button"
            onClick={() => {
              setJurisdictionFilter("ALL");
              setStageFilter("ALL");
            }}
            className={`px-2.5 py-1 text-xs font-medium ${jurisdictionFilter === "ALL" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            All Matters
          </button>
          {JURISDICTION_VALUES.map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => {
                setJurisdictionFilter(j);
                setStageFilter("ALL");
              }}
              className={`border-l px-2.5 py-1 text-xs font-medium ${jurisdictionFilter === j ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              {j}
            </button>
          ))}
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as MatterStage | "ALL")}
          className="h-7 rounded-lg border border-input bg-background px-2 text-xs"
          aria-label="Filter by matter stage"
        >
          <option value="ALL">All Stages</option>
          {stageOptions.map((s) => (
            <option key={s} value={s}>
              {MATTER_STAGE_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as WorkPriority | "ALL")}
          className="h-7 rounded-lg border border-input bg-background px-2 text-xs"
          aria-label="Filter by priority"
        >
          <option value="ALL">All Priorities</option>
          {WORK_PRIORITY_VALUES.map((p) => (
            <option key={p} value={p}>
              {WORK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as FilterTab)} className="min-w-0">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsIndicator />
          {TABS.map((t) => (
            <TabsTab key={t.value} value={t.value}>
              {t.label} ({grouped.get(t.value)?.length ?? 0})
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing here" description="Nothing matches these filters right now." />
      ) : (
        <div className="grid gap-2">
          {visible.map((item) => (
            <WorkItemRow key={item.id} item={item} isFeatured={item.id === featuredId} />
          ))}
        </div>
      )}
    </div>
  );
}
