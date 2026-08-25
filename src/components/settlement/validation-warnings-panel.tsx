"use client";

import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSettlementStatement } from "./use-settlement-statement";
import type { AdjustmentMessage, MessageTier } from "@/lib/settlement/types";

const TIER_ORDER: MessageTier[] = ["error", "warning", "info"];
const TIER_META: Record<MessageTier, { label: string; icon: typeof Info; className: string }> = {
  error: { label: "Errors", icon: CircleAlert, className: "text-destructive" },
  warning: { label: "Warnings", icon: TriangleAlert, className: "text-amber-700 dark:text-amber-400" },
  info: { label: "Information", icon: Info, className: "text-blue-700 dark:text-blue-400" },
};

export function ValidationWarningsPanel() {
  const { results, statement } = useSettlementStatement();
  const all: AdjustmentMessage[] = [...statement.messages, ...results.flatMap((r) => r.messages)];

  if (all.length === 0) {
    return (
      <p className="text-sm text-muted-foreground print:hidden">Calculation completed — no warnings or errors.</p>
    );
  }

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-sm">Validation &amp; Warnings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {TIER_ORDER.map((tier) => {
          const messages = all.filter((m) => m.tier === tier);
          if (messages.length === 0) return null;
          const meta = TIER_META[tier];
          return (
            <div key={tier} className="grid gap-1">
              <span className={cn("flex items-center gap-1.5 text-xs font-semibold", meta.className)}>
                <meta.icon className="size-3.5" />
                {meta.label} ({messages.length})
              </span>
              <ul className="grid gap-1 pl-5 text-xs text-muted-foreground">
                {messages.map((m, i) => (
                  <li key={i} className="list-disc">{m.text}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
