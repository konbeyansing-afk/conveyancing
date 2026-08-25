"use client";

/**
 * Shared shell for one adjustment card: header (title, tier badge, remove),
 * category-specific fields (children), messages footer, and — for the
 * auto-calculating categories — the calculation trail and override control.
 */

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalculationTrail, CalculationTrailPrint } from "./calculation-trail";
import { OverrideControl } from "./override-control";
import { cn } from "@/lib/utils";
import type { AdjustmentCalculationResult, ManualOverride } from "@/lib/settlement/types";

const TIER_BADGE: Record<AdjustmentCalculationResult["tier"], { label: string; className: string }> = {
  ok: { label: "Ready", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  info: { label: "Info", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  warning: { label: "Warning", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  error: { label: "Needs attention", className: "bg-destructive/10 text-destructive" },
};

export function AdjustmentCard({
  title,
  categoryLabel,
  result,
  onRemove,
  children,
  override,
  onOverrideChange,
  showOverride = true,
}: {
  title: string;
  categoryLabel: string;
  result: AdjustmentCalculationResult;
  onRemove: () => void;
  children: React.ReactNode;
  override?: ManualOverride;
  onOverrideChange?: (next: ManualOverride) => void;
  showOverride?: boolean;
}) {
  const badge = result.pending ? { label: "Pending", className: "bg-muted text-muted-foreground" } : TIER_BADGE[result.tier];

  return (
    <Card className="print:break-inside-avoid print:border-none print:shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-xs font-normal text-muted-foreground">{categoryLabel}</span>
          <span className="flex-1">{title}</span>
          <Badge className={cn(badge.className)}>{badge.label}</Badge>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} className="print:hidden" aria-label="Remove adjustment">
            <Trash2 className="size-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {children}

        {result.messages.length > 0 && (
          <ul className="grid gap-1 print:hidden">
            {result.messages.map((m, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs",
                  m.tier === "error" && "bg-destructive/10 text-destructive",
                  m.tier === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                  m.tier === "info" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                )}
              >
                {m.text}
              </li>
            ))}
          </ul>
        )}

        {result.automatic && <CalculationTrail trail={result.automatic.trail} />}
        {result.automatic && <CalculationTrailPrint trail={result.automatic.trail} />}

        {showOverride && override && onOverrideChange && (
          <OverrideControl result={result} override={override} onChange={onOverrideChange} />
        )}
      </CardContent>
    </Card>
  );
}
