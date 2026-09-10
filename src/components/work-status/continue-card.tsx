import Link from "next/link";
import { ArrowRight, ListTodo } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PrimaryNextAction } from "@/lib/va-dashboard";

/**
 * The dashboard-level "Continue" CTA (spec section 3/4) — the single most
 * relevant outstanding checklist task across every one of the VA's matters,
 * not just the spotlighted ones. Renders nothing when there genuinely isn't
 * one (see pickPrimaryNextAction) — never a fabricated "you're all caught
 * up" without the underlying data actually saying so.
 */
export function ContinueCard({ action, workItemHref }: { action: PrimaryNextAction | null; workItemHref: string }) {
  if (!action) return null;

  return (
    <Link href={workItemHref} className="block">
      <Card className="border-primary/40 bg-primary/5 transition-colors hover:border-primary/60">
        <CardContent className="flex items-center gap-3 py-4">
          <ListTodo className="size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Continue</p>
            <p className="truncate text-lg font-semibold">{action.task.title}</p>
            <p className="truncate text-sm text-muted-foreground">{action.matterTitle}</p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-primary" />
        </CardContent>
      </Card>
    </Link>
  );
}
