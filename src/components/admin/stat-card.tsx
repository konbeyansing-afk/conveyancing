import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {Icon && (
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              tone === "success" && "bg-success/10 text-success",
              tone === "warning" && "bg-warning/10 text-warning",
              tone === "default" && "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
