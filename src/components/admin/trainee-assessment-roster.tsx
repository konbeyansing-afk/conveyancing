"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { AssessmentStatus, TrainingStatus } from "@/lib/assessment-dashboard";
import { cn } from "@/lib/utils";

export type TraineeRosterRow = {
  id: string;
  name: string;
  email: string;
  role: "TRAINEE" | "VA";
  jurisdiction: "QLD" | "NSW" | "VIC" | "UK" | null;
  programTitle: string | null;
  progressPercent: number;
  trainingStatus: TrainingStatus;
  assessmentStatus: AssessmentStatus;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  latestAssessmentTitle: string | null;
  latestScore: number | null;
  lastActivityAt: Date | null;
};

const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  NEEDS_ATTENTION: "Needs Attention",
};

const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  NOT_ATTEMPTED: "Not Attempted",
  PASSED: "Passed",
  FAILED: "Failed",
  IN_PROGRESS: "In Progress",
};

const JURISDICTION_LABELS: Record<NonNullable<TraineeRosterRow["jurisdiction"]>, string> = {
  QLD: "Queensland",
  NSW: "New South Wales",
  VIC: "Victoria",
  UK: "United Kingdom",
};

function statusBadgeVariant(status: TrainingStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "NEEDS_ATTENTION":
      return "destructive";
    case "IN_PROGRESS":
      return "secondary";
    default:
      return "outline";
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type SortKey = "name" | "progress" | "activity" | "score" | "status";

const TRAINING_STATUS_SORT_WEIGHT: Record<TrainingStatus, number> = {
  NEEDS_ATTENTION: 0,
  IN_PROGRESS: 1,
  NOT_STARTED: 2,
  COMPLETED: 3,
};

export function TraineeAssessmentRoster({
  trainees,
  jurisdictionCounts,
}: {
  trainees: TraineeRosterRow[];
  jurisdictionCounts: Record<NonNullable<TraineeRosterRow["jurisdiction"]>, number>;
}) {
  const [query, setQuery] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string>("ALL");
  const [trainingStatus, setTrainingStatus] = useState<string>("ALL");
  const [assessmentStatus, setAssessmentStatus] = useState<string>("ALL");
  const [sort, setSort] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = trainees;
    if (q) {
      rows = rows.filter((t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
    }
    if (jurisdiction !== "ALL") {
      rows = rows.filter((t) => t.jurisdiction === jurisdiction);
    }
    if (trainingStatus !== "ALL") {
      rows = rows.filter((t) => t.trainingStatus === trainingStatus);
    }
    if (assessmentStatus !== "ALL") {
      rows = rows.filter((t) => t.assessmentStatus === assessmentStatus);
    }

    const sorted = [...rows];
    switch (sort) {
      case "progress":
        sorted.sort((a, b) => b.progressPercent - a.progressPercent);
        break;
      case "activity":
        sorted.sort((a, b) => {
          const bTime = b.lastActivityAt ? b.lastActivityAt.getTime() : 0;
          const aTime = a.lastActivityAt ? a.lastActivityAt.getTime() : 0;
          return bTime - aTime;
        });
        break;
      case "score":
        sorted.sort((a, b) => (b.latestScore ?? -1) - (a.latestScore ?? -1));
        break;
      case "status":
        sorted.sort(
          (a, b) => TRAINING_STATUS_SORT_WEIGHT[a.trainingStatus] - TRAINING_STATUS_SORT_WEIGHT[b.trainingStatus],
        );
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [trainees, query, jurisdiction, trainingStatus, assessmentStatus, sort]);

  const jurisdictionsPresent = (Object.keys(jurisdictionCounts) as (keyof typeof jurisdictionCounts)[]).filter(
    (j) => jurisdictionCounts[j] > 0,
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-8"
          />
        </div>

        <Select value={jurisdiction} onValueChange={(v) => setJurisdiction(v as string)}>
          <SelectTrigger><SelectValue placeholder="Jurisdiction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All jurisdictions</SelectItem>
            {jurisdictionsPresent.map((j) => (
              <SelectItem key={j} value={j}>
                {JURISDICTION_LABELS[j]} ({jurisdictionCounts[j]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={trainingStatus} onValueChange={(v) => setTrainingStatus(v as string)}>
          <SelectTrigger><SelectValue placeholder="Training status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All training statuses</SelectItem>
            {(Object.keys(TRAINING_STATUS_LABELS) as TrainingStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {TRAINING_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assessmentStatus} onValueChange={(v) => setAssessmentStatus(v as string)}>
          <SelectTrigger><SelectValue placeholder="Assessment status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All assessment statuses</SelectItem>
            {(Object.keys(ASSESSMENT_STATUS_LABELS) as AssessmentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {ASSESSMENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="progress">Sort: Overall Progress</SelectItem>
            <SelectItem value="activity">Sort: Last Activity</SelectItem>
            <SelectItem value="score">Sort: Assessment Score</SelectItem>
            <SelectItem value="status">Sort: Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={trainees.length === 0 ? "No trainees or VAs yet" : "No one matches these filters"}
          description={
            trainees.length === 0
              ? "Create an account from the Users page to see their progress here."
              : "Try a different search term or clear a filter."
          }
        />
      ) : (
        <div className="grid gap-2">
          {filtered.map((trainee) => (
            <Link key={trainee.id} href={`/admin/assessments/trainee/${trainee.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                    <Avatar className="shrink-0">
                      <AvatarFallback>{initials(trainee.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-medium">{trainee.name}</p>
                        <Badge variant="outline">{trainee.role}</Badge>
                        {trainee.jurisdiction && <Badge variant="outline">{trainee.jurisdiction}</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{trainee.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {trainee.programTitle ?? "Not enrolled in a program"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0 sm:items-center">
                    <div className="sm:w-32">
                      <div className="flex items-center gap-2">
                        <Progress value={trainee.progressPercent} className="flex-1" />
                        <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums">
                          {trainee.progressPercent}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {trainee.passedCount} Passed
                        {trainee.pendingCount > 0 ? ` / ${trainee.pendingCount} Pending` : ""}
                        {trainee.failedCount > 0 ? ` / ${trainee.failedCount} Failed` : ""}
                      </p>
                    </div>

                    <div className="text-right text-sm sm:w-28">
                      <p className="truncate font-medium">
                        {trainee.latestScore !== null ? `${trainee.latestScore}%` : "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {trainee.latestAssessmentTitle ?? "No assessments"}
                      </p>
                    </div>

                    <p className="text-left text-xs text-muted-foreground sm:w-24 sm:text-right">
                      {trainee.lastActivityAt ? formatRelativeTime(trainee.lastActivityAt) : "No activity"}
                    </p>

                    <div className="flex items-center justify-end sm:justify-start">
                      <Badge variant={statusBadgeVariant(trainee.trainingStatus)} className={cn("shrink-0")}>
                        {TRAINING_STATUS_LABELS[trainee.trainingStatus]}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
