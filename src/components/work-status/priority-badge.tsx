import { Badge } from "@/components/ui/badge";
import { WORK_PRIORITY_LABELS } from "@/lib/work-status";
import type { WorkPriority } from "@prisma/client";

const PRIORITY_VARIANT: Record<WorkPriority, "outline" | "secondary" | "default" | "destructive"> = {
  LOW: "outline",
  NORMAL: "secondary",
  HIGH: "default",
  URGENT: "destructive",
};

export function PriorityBadge({ priority, className }: { priority: WorkPriority; className?: string }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} className={className}>
      {WORK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
