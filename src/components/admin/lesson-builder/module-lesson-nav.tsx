import Link from "next/link";
import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SiblingLesson = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  isPublished: boolean;
  hasContent: boolean;
};

export function ModuleLessonNav({
  programId,
  courseId,
  moduleTitle,
  lessons,
  currentLessonId,
}: {
  programId: string;
  courseId: string;
  moduleTitle: string;
  lessons: SiblingLesson[];
  currentLessonId: string;
}) {
  return (
    <div className="grid gap-2 rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {moduleTitle} — Lessons
      </p>
      <div className="grid gap-0.5">
        {lessons.map((lesson) => {
          const isCurrent = lesson.id === currentLessonId;
          const Icon = isCurrent ? PlayCircle : lesson.hasContent ? CheckCircle2 : Circle;
          return (
            <Link
              key={lesson.id}
              href={`/admin/programs/${programId}/courses/${courseId}/lessons/${lesson.id}`}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                isCurrent ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  isCurrent
                    ? "text-primary"
                    : lesson.hasContent
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground/40"
                )}
              />
              <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
              {lesson.estimatedMinutes && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {lesson.estimatedMinutes} min
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
