"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/work-status/status-badge";
import { PriorityBadge } from "@/components/work-status/priority-badge";
import { MatterStageBadge } from "@/components/work-status/matter-stage-badge";
import { JurisdictionBadge } from "@/components/work-status/jurisdiction-badge";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
  WORK_PRIORITY_LABELS,
  WORK_PRIORITY_VALUES,
  WORK_STATUS_LABELS,
  WORK_STATUS_VALUES,
  dayKey,
} from "@/lib/work-status";
import { JURISDICTION_LABELS, JURISDICTION_VALUES, MATTER_STAGE_LABELS, matterWorkflow } from "@/lib/matter-stage";
import type { Jurisdiction, MatterStage, WorkPriority, WorkStatus } from "@prisma/client";

export type VaSummary = {
  id: string;
  name: string;
  email: string;
  currentTask: string | null;
  currentMatter: string | null;
  jurisdiction: Jurisdiction | null;
  matterStage: MatterStage | null;
  status: WorkStatus | null;
  priority: WorkPriority | null;
  lastUpdated: string | null;
  completedToday: number;
  /** Checklist completion for the representative matter, 0-100, or null when no checklist template applies. */
  checklistProgress: number | null;
  blockedTaskCount: number;
  /** Titles/matter refs/notes across this VA's work items, for search. */
  searchText: string;
};

type HealthStatus = "ON_TRACK" | "AT_RISK" | "BLOCKED" | "COMPLETED";

/**
 * On Track / At Risk / Blocked / Completed (spec section 11) — derived
 * live from the VA's current work status and checklist, never a stored
 * field: Blocked wins outright (the work itself is stuck), Completed means
 * the representative matter's checklist is fully done, At Risk means
 * something on the checklist is Blocked even though the matter's overall
 * status isn't, and On Track is everything else with an active matter.
 */
function healthStatus(va: VaSummary): HealthStatus | null {
  if (!va.status) return null;
  if (va.status === "BLOCKED") return "BLOCKED";
  if (va.status === "COMPLETED" || va.checklistProgress === 100) return "COMPLETED";
  if (va.blockedTaskCount > 0) return "AT_RISK";
  return "ON_TRACK";
}

const HEALTH_LABELS: Record<HealthStatus, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type DateFilter = "all" | "today" | "yesterday" | "7days" | "custom";

/** Admin filters (spec section 12): VA, status, priority, date, search — all combine. */
export function VaStatusTable({ vas }: { vas: VaSummary[] }) {
  const [vaFilter, setVaFilter] = useState("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<Jurisdiction | "all">("all");
  const [stageFilter, setStageFilter] = useState<MatterStage | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<HealthStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [query, setQuery] = useState("");

  const stageOptions = useMemo(() => {
    if (jurisdictionFilter === "all") {
      return Array.from(new Set([...matterWorkflow("QLD"), ...matterWorkflow("NSW")]));
    }
    return matterWorkflow(jurisdictionFilter);
  }, [jurisdictionFilter]);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayKey = dayKey(now);
    const yesterdayKey = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const q = query.trim().toLowerCase();

    return vas.filter((va) => {
      if (vaFilter !== "all" && va.id !== vaFilter) return false;
      if (jurisdictionFilter !== "all" && va.jurisdiction !== jurisdictionFilter) return false;
      if (stageFilter !== "all" && va.matterStage !== stageFilter) return false;
      if (statusFilter !== "all" && va.status !== statusFilter) return false;
      if (healthFilter !== "all" && healthStatus(va) !== healthFilter) return false;
      if (priorityFilter !== "all" && va.priority !== priorityFilter) return false;

      if (dateFilter !== "all") {
        if (!va.lastUpdated) return false;
        const updated = new Date(va.lastUpdated);
        if (dateFilter === "today" && dayKey(updated) !== todayKey) return false;
        if (dateFilter === "yesterday" && dayKey(updated) !== yesterdayKey) return false;
        if (dateFilter === "7days" && updated.getTime() < sevenDaysAgo) return false;
        if (dateFilter === "custom") {
          if (customStart && dayKey(updated) < customStart) return false;
          if (customEnd && dayKey(updated) > customEnd) return false;
        }
      }

      if (q) {
        const haystack = `${va.name} ${va.email} ${va.searchText}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    vas,
    vaFilter,
    jurisdictionFilter,
    stageFilter,
    statusFilter,
    healthFilter,
    priorityFilter,
    dateFilter,
    customStart,
    customEnd,
    query,
  ]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search task, matter, notes…"
            className="pl-8"
          />
        </div>
        <select
          value={vaFilter}
          onChange={(e) => setVaFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="all">All VAs</option>
          {vas.map((va) => (
            <option key={va.id} value={va.id}>
              {va.name}
            </option>
          ))}
        </select>
        <select
          value={jurisdictionFilter}
          onChange={(e) => {
            setJurisdictionFilter(e.target.value as Jurisdiction | "all");
            setStageFilter("all");
          }}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="all">All Jurisdictions</option>
          {JURISDICTION_VALUES.map((j) => (
            <option key={j} value={j}>
              {JURISDICTION_LABELS[j]}
            </option>
          ))}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as MatterStage | "all")}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="all">All Matter Stages</option>
          {stageOptions.map((s) => (
            <option key={s} value={s}>
              {MATTER_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="all">All Statuses</option>
          {WORK_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {WORK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value as HealthStatus | "all")}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="all">All (On Track / At Risk / Blocked / Completed)</option>
          {(Object.keys(HEALTH_LABELS) as HealthStatus[]).map((h) => (
            <option key={h} value={h}>
              {HEALTH_LABELS[h]}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="all">All Priorities</option>
          {WORK_PRIORITY_VALUES.map((p) => (
            <option key={p} value={p}>
              {WORK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="all">Any Date</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7days">Last 7 Days</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>

      {dateFilter === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="w-auto"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="w-auto"
            aria-label="To date"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={vas.length === 0 ? "No VAs yet" : "No matches"}
          description={
            vas.length === 0
              ? "Create VA accounts from the Users page."
              : "Try different filters or a different search term."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          {/* overflow-x-auto, not overflow-hidden: wider than a phone, columns
              on the right would otherwise be unreachable. */}
          <table className="w-full min-w-[50rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-2.5 font-medium">VA</th>
                <th className="px-4 py-2.5 font-medium">Current Task</th>
                <th className="px-4 py-2.5 font-medium">Jurisdiction</th>
                <th className="px-4 py-2.5 font-medium">Matter Stage</th>
                <th className="px-4 py-2.5 font-medium">Work Status</th>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Checklist</th>
                <th className="px-4 py-2.5 font-medium">Last Updated</th>
                <th className="px-4 py-2.5 font-medium">Completed Today</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((va) => (
                <tr key={va.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/work-status/${va.id}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <Avatar size="sm">
                        <AvatarFallback>{initials(va.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{va.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{va.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[16rem] truncate">{va.currentTask ?? "—"}</p>
                    {va.currentMatter && (
                      <p className="text-xs text-muted-foreground">Matter #{va.currentMatter}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {va.jurisdiction ? (
                      <JurisdictionBadge jurisdiction={va.jurisdiction} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {va.matterStage ? (
                      <MatterStageBadge stage={va.matterStage} className="px-2 py-0.5 text-[0.7rem]" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {va.status ? (
                      <StatusBadge status={va.status} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {va.priority ? (
                      <PriorityBadge priority={va.priority} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {va.checklistProgress === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="grid w-24 gap-1">
                        <Progress value={va.checklistProgress} className="h-1.5" />
                        <span className="text-xs text-muted-foreground">
                          {va.checklistProgress}%{va.blockedTaskCount > 0 && ` · ${va.blockedTaskCount} blocked`}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {va.lastUpdated ? formatRelativeTime(new Date(va.lastUpdated)) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{va.completedToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
