import { cn } from "@/lib/utils";
import { WORK_STATUS_LABELS } from "@/lib/work-status";
import type { WorkStatus } from "@prisma/client";

/**
 * Always renders the status text alongside the dot — never color alone
 * (spec section 5).
 */
const STATUS_STYLES: Record<WorkStatus, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-primary/10 text-primary",
  WAITING_PENDING: "bg-warning/10 text-warning",
  BLOCKED: "bg-destructive/10 text-destructive",
  COMPLETED: "bg-success/10 text-success",
};

const DOT_STYLES: Record<WorkStatus, string> = {
  NOT_STARTED: "bg-muted-foreground",
  IN_PROGRESS: "bg-primary",
  WAITING_PENDING: "bg-warning",
  BLOCKED: "bg-destructive",
  COMPLETED: "bg-success",
};

export function StatusBadge({ status, className }: { status: WorkStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-4xl px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_STYLES[status])} />
      {WORK_STATUS_LABELS[status]}
    </span>
  );
}
