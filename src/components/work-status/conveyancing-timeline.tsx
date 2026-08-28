import { Check, CircleDot, AlertTriangle, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MATTER_STAGE_LABELS, matterWorkflow, stageVisualState, type StageVisualState } from "@/lib/matter-stage";
import type { Jurisdiction, MatterStage } from "@prisma/client";

const STATE_CLASSES: Record<StageVisualState, string> = {
  completed: "bg-success/10 text-success",
  current: "bg-primary/10 text-primary ring-1 ring-primary/30",
  upcoming: "bg-muted text-muted-foreground",
  blocked: "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
};

function StageIcon({ state }: { state: StageVisualState }) {
  const className = "size-3.5 shrink-0";
  switch (state) {
    case "completed":
      return <Check className={className} />;
    case "current":
      return <CircleDot className={className} />;
    case "blocked":
      return <AlertTriangle className={className} />;
    case "upcoming":
      return <Circle className={className} />;
  }
}

/**
 * The Conveyancing Timeline (not a generic "project timeline"): the matter's
 * full jurisdiction-specific workflow, current stage highlighted. Text
 * labels are always shown alongside the icon — never color/icon alone.
 * Responsive via flex-wrap rather than a fixed-width horizontal scroller, so
 * it degrades to a multi-row wrap on narrow screens instead of clipping.
 */
export function ConveyancingTimeline({
  jurisdiction,
  currentStage,
  isWorkBlocked = false,
}: {
  jurisdiction: Jurisdiction;
  currentStage: MatterStage;
  isWorkBlocked?: boolean;
}) {
  const stages = matterWorkflow(jurisdiction);

  return (
    <ol className="flex flex-wrap items-center gap-y-2" aria-label="Conveyancing timeline">
      {stages.map((stage, index) => {
        const state = stageVisualState(jurisdiction, stage, currentStage, isWorkBlocked);
        return (
          <li key={stage} className="flex items-center">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                STATE_CLASSES[state],
              )}
              aria-current={state === "current" || state === "blocked" ? "step" : undefined}
            >
              <StageIcon state={state} />
              {MATTER_STAGE_LABELS[stage]}
            </span>
            {index < stages.length - 1 && (
              <ChevronRight className="mx-0.5 size-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
