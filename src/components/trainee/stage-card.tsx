import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StageStatusBadge } from "@/components/trainee/stage-status-badge";
import { CoverBanner } from "@/lib/cover-theme";
import { cn } from "@/lib/utils";
import type { StageJourneyStatus } from "@/lib/stage-access";

const statusCta: Record<StageJourneyStatus["status"], string> = {
  completed: "Review stage",
  current: "Continue learning",
  locked: "View requirements",
};

export function StageCard({ stage }: { stage: StageJourneyStatus }) {
  const isLocked = stage.status === "locked";

  return (
    <Link
      href={`/app/journey/${stage.id}`}
      className="group block h-full rounded-xl focus-visible:outline-none"
      aria-label={`Stage ${stage.order + 1}: ${stage.title} — ${stage.status}`}
    >
      <Card
        className={cn(
          "h-full gap-0 overflow-hidden py-0 transition-all group-focus-visible:ring-2 group-focus-visible:ring-ring",
          stage.status === "current" && "ring-2 ring-primary/40",
          !isLocked && "group-hover:-translate-y-0.5 group-hover:shadow-(--shadow-raised)"
        )}
      >
        {isLocked ? (
          <div className="flex h-28 items-center justify-center bg-muted">
            <Lock className="size-8 text-muted-foreground" strokeWidth={1.5} />
          </div>
        ) : (
          <CoverBanner title={stage.title} imageUrl={stage.programCoverImageUrl} className="h-28" />
        )}

        <CardContent className="flex h-full flex-col gap-3 py-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase tabular-nums">
              <span aria-hidden className="text-primary">{String(stage.order + 1).padStart(2, "0")}</span>
              <span className="sr-only">Stage {stage.order + 1}</span>
            </p>
            <StageStatusBadge status={stage.status} />
          </div>

          <h3 className="font-heading text-base leading-snug font-semibold text-balance">
            {stage.title}
          </h3>

          {stage.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{stage.description}</p>
          )}

          {isLocked ? (
            <p className="mt-auto text-sm text-muted-foreground">
              {stage.prerequisiteStageTitle
                ? `Complete "${stage.prerequisiteStageTitle}" to unlock`
                : "Locked"}
            </p>
          ) : (
            <div className="mt-auto grid gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  {stage.totalLessons > 0
                    ? `${stage.completedLessons} of ${stage.totalLessons} lessons`
                    : "Content coming soon"}
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {stage.progressPercent}%
                </span>
              </div>
              <Progress value={stage.progressPercent} aria-label={`${stage.title} progress`} />
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {stage.courses.length} {stage.courses.length === 1 ? "course" : "courses"}
            </span>
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                isLocked ? "text-muted-foreground" : "text-primary"
              )}
            >
              {statusCta[stage.status]}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
