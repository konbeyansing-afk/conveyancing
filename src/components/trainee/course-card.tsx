import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CourseStatusBadge, type CourseStatus } from "@/components/trainee/course-status-badge";
import { CoverBanner } from "@/lib/cover-theme";

export type TraineeCourseSummary = {
  id: string;
  title: string;
  description: string | null;
  programTitle: string;
  programCoverImageUrl: string | null;
  moduleCount: number;
  lessonCount: number;
  progressPercent: number;
  status: CourseStatus;
};

const statusCta: Record<CourseStatus, string> = {
  "not-started": "Start course",
  "in-progress": "Continue learning",
  completed: "Review course",
};

export function CourseCard({ course }: { course: TraineeCourseSummary }) {
  return (
    <Link
      href={`/app/courses/${course.id}`}
      className="group block h-full rounded-xl focus-visible:outline-none"
      aria-label={`${course.title} — ${course.progressPercent}% complete, ${statusCta[course.status]}`}
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CoverBanner title={course.title} imageUrl={course.programCoverImageUrl} className="h-28" />
        <CardContent className="flex h-full flex-col gap-4 py-5">
          <div className="grid min-w-0 gap-0.5">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {course.programTitle}
            </p>
            <h3 className="font-heading text-base leading-snug font-semibold text-balance">
              {course.title}
            </h3>
          </div>

          {course.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
          )}

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Layers className="size-3.5 shrink-0" />
            <span>
              {course.moduleCount} {course.moduleCount === 1 ? "module" : "modules"} ·{" "}
              {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
            </span>
          </div>

          <div className="mt-auto grid gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Progress</span>
              <span className="font-semibold text-foreground tabular-nums">
                {course.progressPercent}%
              </span>
            </div>
            <Progress value={course.progressPercent} aria-label={`${course.title} progress`} />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <CourseStatusBadge status={course.status} />
            <span className="flex items-center gap-1 text-sm font-medium text-primary">
              {statusCta[course.status]}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
