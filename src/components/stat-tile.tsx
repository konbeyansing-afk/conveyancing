import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  icon: Icon,
  value,
  label,
  hint,
  tone = "default",
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "success" && "bg-success/10 text-success",
          tone === "warning" && "bg-warning/10 text-warning",
          tone === "default" && "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl leading-none font-semibold tabular-nums">{value}</p>
        <p className="mt-1.5 text-sm leading-tight font-medium">{label}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
