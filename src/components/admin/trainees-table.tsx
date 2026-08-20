"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { Users } from "lucide-react";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type TraineeSummary = {
  id: string;
  name: string;
  email: string;
  enrollmentCount: number;
  completedCourseCount: number;
  avgCompletion: number;
  lastActivity: string | null;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TraineesTable({ trainees }: { trainees: TraineeSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trainees;
    return trainees.filter(
      (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    );
  }, [trainees, query]);

  return (
    <div className="grid gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trainees…"
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={trainees.length === 0 ? "No trainees yet" : "No trainees match your search"}
          description={
            trainees.length === 0
              ? "Create trainee accounts from the Users page, then enroll them in a course."
              : "Try a different search term."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-2.5 font-medium">Trainee</th>
                <th className="px-4 py-2.5 font-medium">Courses</th>
                <th className="px-4 py-2.5 font-medium">Completed</th>
                <th className="px-4 py-2.5 font-medium">Avg. Progress</th>
                <th className="px-4 py-2.5 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trainee) => (
                <tr key={trainee.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback>{initials(trainee.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{trainee.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{trainee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{trainee.enrollmentCount}</td>
                  <td className="px-4 py-3 tabular-nums">{trainee.completedCourseCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={trainee.avgCompletion} className="w-24" />
                      <span className="text-xs font-medium tabular-nums">
                        {trainee.avgCompletion}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {trainee.lastActivity ? formatRelativeTime(new Date(trainee.lastActivity)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
