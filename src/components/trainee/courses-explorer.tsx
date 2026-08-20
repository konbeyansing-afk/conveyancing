"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTab, TabsIndicator } from "@/components/ui/tabs";
import { CourseCard, type TraineeCourseSummary } from "@/components/trainee/course-card";
import { NoCoursesEmptyState } from "@/components/trainee/no-courses-empty-state";
import { EmptyState } from "@/components/empty-state";
import type { CourseStatus } from "@/components/trainee/course-status-badge";

type FilterTab = "all" | CourseStatus;

const tabs: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All Courses" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "not-started", label: "Not Started" },
];

export function CoursesExplorer({ courses }: { courses: TraineeCourseSummary[] }) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let result = courses;
    if (tab !== "all") result = result.filter((course) => course.status === tab);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (course) =>
          course.title.toLowerCase().includes(q) || course.programTitle.toLowerCase().includes(q)
      );
    }
    return result;
  }, [courses, tab, query]);

  if (courses.length === 0) {
    return <NoCoursesEmptyState />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(value) => setTab(value as FilterTab)} className="min-w-0">
          <TabsList className="max-w-full overflow-x-auto">
            <TabsIndicator />
            {tabs.map((t) => (
              <TabsTab key={t.value} value={t.value}>
                {t.label}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full lg:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses…"
            className="pl-8"
            aria-label="Search courses"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No courses match"
          description="Try a different search term or filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
