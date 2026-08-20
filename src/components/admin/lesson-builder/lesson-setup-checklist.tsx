import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChecklistItem = { label: string; done: boolean; required?: boolean };

export function LessonSetupChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-medium">Lesson setup</p>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full",
                item.done
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : item.required
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {item.done ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
            {!item.done && item.required && (
              <span className="ml-auto text-xs text-destructive">Required</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
