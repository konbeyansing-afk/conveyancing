import { CheckCircle2, CircleDashed, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CourseStatus = "not-started" | "in-progress" | "completed";

const statusConfig: Record<
  CourseStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  "not-started": {
    label: "Not Started",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
  "in-progress": {
    label: "In Progress",
    icon: PlayCircle,
    className: "bg-warning/10 text-warning",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
  },
};

export function CourseStatusBadge({
  status,
  className,
}: {
  status: CourseStatus;
  className?: string;
}) {
  const { label, icon: Icon, className: toneClassName } = statusConfig[status];
  return (
    <Badge variant="secondary" className={cn(toneClassName, className)}>
      <Icon />
      {label}
    </Badge>
  );
}
