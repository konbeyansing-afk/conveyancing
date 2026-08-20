import { CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StageStatus = "completed" | "current" | "locked";

const statusConfig: Record<
  StageStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
  },
  current: {
    label: "In Progress",
    icon: PlayCircle,
    className: "bg-primary/10 text-primary",
  },
  locked: {
    label: "Locked",
    icon: Lock,
    className: "bg-muted text-muted-foreground",
  },
};

export function StageStatusBadge({ status, className }: { status: StageStatus; className?: string }) {
  const { label, icon: Icon, className: toneClassName } = statusConfig[status];
  return (
    <Badge variant="secondary" className={cn(toneClassName, className)}>
      <Icon />
      {label}
    </Badge>
  );
}
