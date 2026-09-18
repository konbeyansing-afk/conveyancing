import { Clock, ListChecks, PlayCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrainingJurisdiction } from "@prisma/client";

const JURISDICTION_LABEL: Record<TrainingJurisdiction, { flag: string; label: string }> = {
  QLD: { flag: "🇦🇺", label: "Queensland" },
  NSW: { flag: "🇦🇺", label: "New South Wales" },
  VIC: { flag: "🇦🇺", label: "Victoria" },
  UK: { flag: "🇬🇧", label: "United Kingdom" },
};

export function JurisdictionBadge({ jurisdiction }: { jurisdiction: TrainingJurisdiction | null | undefined }) {
  if (!jurisdiction) return null;
  const info = JURISDICTION_LABEL[jurisdiction];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide uppercase"
      style={{ borderColor: "var(--deck-border)", color: "var(--deck-accent)", backgroundColor: "var(--deck-accent-soft)" }}
    >
      <span aria-hidden>{info.flag}</span>
      {info.label}
    </span>
  );
}

export type LessonProgressState = "not_started" | "completed";

export function LessonIntroScreen({
  lessonTitle,
  moduleTitle,
  stageTitle,
  jurisdiction,
  estimatedMinutes,
  agenda,
  progressState,
  onStart,
}: {
  lessonTitle: string;
  moduleTitle: string;
  stageTitle: string | null;
  jurisdiction: TrainingJurisdiction | null | undefined;
  estimatedMinutes: number | null;
  agenda: string[];
  progressState: LessonProgressState;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col justify-center px-4 py-10 text-center sm:px-8">
      <div className="deck-slide-enter flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <JurisdictionBadge jurisdiction={jurisdiction} />
          {stageTitle && (
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stageTitle}</span>
          )}
        </div>

        <p className="text-sm font-medium text-muted-foreground">{moduleTitle}</p>
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl" style={{ color: "var(--deck-ink)" }}>
          {lessonTitle}
        </h1>

        {estimatedMinutes != null && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" />
            About {estimatedMinutes} {estimatedMinutes === 1 ? "minute" : "minutes"}
          </span>
        )}

        {agenda.length > 0 && (
          <div
            className="mt-4 w-full rounded-xl border p-5 text-left"
            style={{ borderColor: "var(--deck-border)", backgroundColor: "var(--deck-surface)" }}
          >
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <ListChecks className="size-4" />
              What you&apos;ll cover
            </p>
            <ol className="mt-3 grid gap-2">
              {agenda.map((title, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--deck-ink)" }}>
                  <span
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                    style={{ backgroundColor: "var(--deck-accent-soft)", color: "var(--deck-accent)" }}
                  >
                    {i + 1}
                  </span>
                  {title}
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="mt-2 text-sm text-muted-foreground">
          {progressState === "completed" ? "You've already completed this lesson." : "Not started yet."}
        </p>

        <Button size="lg" onClick={onStart} className="mt-2">
          {progressState === "completed" ? (
            <>
              <RotateCcw /> Review Lesson
            </>
          ) : (
            <>
              <PlayCircle /> Start Lesson
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
