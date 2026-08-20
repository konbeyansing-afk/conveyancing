"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/empty-state";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { CoverBanner } from "@/lib/cover-theme";

export type ProgramSummary = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  updatedAt: string;
  courseCount: number;
  moduleCount: number;
  lessonCount: number;
  traineeCount: number;
  completion: number;
};

type StatusFilter = "all" | "published" | "draft";
type SortOption = "updated" | "name";

export function ProgramsGrid({ programs }: { programs: ProgramSummary[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("updated");

  const filtered = useMemo(() => {
    let result = programs;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    if (status !== "all") {
      result = result.filter((p) => (status === "published" ? p.isPublished : !p.isPublished));
    }

    return [...result].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [programs, query, status, sort]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search programs…"
            className="pl-8"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={programs.length === 0 ? "No programs yet" : "No programs match your search"}
          description={
            programs.length === 0
              ? "Create your first program above — QLD Conveyancing will be the first."
              : "Try a different search term or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((program) => {
            return (
              <Link key={program.id} href={`/admin/programs/${program.id}`} className="group">
                <Card className="h-full gap-0 overflow-hidden py-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <CoverBanner title={program.title} imageUrl={program.coverImageUrl} className="h-24" />
                  <CardContent className="flex flex-col gap-3 py-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-heading text-base font-semibold text-balance">
                        {program.title}
                      </h3>
                      <StatusBadge isPublished={program.isPublished} />
                    </div>
                    {program.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {program.description}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-muted/60 px-3 py-2">
                        <p className="font-semibold text-foreground">{program.courseCount}</p>
                        <p className="text-xs text-muted-foreground">
                          {program.courseCount === 1 ? "Course" : "Courses"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/60 px-3 py-2">
                        <p className="font-semibold text-foreground">{program.lessonCount}</p>
                        <p className="text-xs text-muted-foreground">
                          {program.lessonCount === 1 ? "Lesson" : "Lessons"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/60 px-3 py-2">
                        <p className="font-semibold text-foreground">{program.traineeCount}</p>
                        <p className="text-xs text-muted-foreground">
                          {program.traineeCount === 1 ? "Trainee" : "Trainees"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/60 px-3 py-2">
                        <p className="font-semibold text-foreground">{program.moduleCount}</p>
                        <p className="text-xs text-muted-foreground">
                          {program.moduleCount === 1 ? "Module" : "Modules"}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-1.5 border-t pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">Avg. Completion</span>
                        <span className="font-semibold text-primary">{program.completion}%</span>
                      </div>
                      <Progress value={program.completion} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatRelativeTime(new Date(program.updatedAt))}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
