import { cn } from "@/lib/utils";
import { MATTER_STAGE_LABELS } from "@/lib/matter-stage";
import type { MatterStage } from "@prisma/client";

/**
 * The prominent "where is the matter?" badge — deliberately louder than
 * StatusBadge/PriorityBadge (spec: "the conveyancing stage should be
 * visually more prominent than the generic work status"), but a single
 * primary treatment rather than a different colour per stage (spec section
 * 12: "use visual hierarchy rather than making every stage a different
 * colour").
 */
export function MatterStageBadge({ stage, className }: { stage: MatterStage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full bg-primary px-3 py-1 text-sm font-semibold tracking-wide text-primary-foreground uppercase",
        className,
      )}
    >
      {MATTER_STAGE_LABELS[stage]}
    </span>
  );
}
