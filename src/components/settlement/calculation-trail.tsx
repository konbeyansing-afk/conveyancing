"use client";

/** "View Calculation" — the dynamically generated breakdown behind an adjustment's figure. */

import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { CalculationTrailStep } from "@/lib/settlement/types";

export function CalculationTrail({ trail }: { trail: CalculationTrailStep[] }) {
  if (trail.length === 0) return null;
  return (
    <Collapsible className="print:hidden">
      <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
        View calculation
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
        <dl className="mt-2 grid gap-1 rounded-md border bg-muted/30 p-3 text-xs">
          {trail.map((step, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{step.label}</dt>
              <dd className="text-right font-medium">{step.value}</dd>
            </div>
          ))}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Print-only, always-expanded rendering of the same trail (Collapsible state doesn't survive print). */
export function CalculationTrailPrint({ trail }: { trail: CalculationTrailStep[] }) {
  if (trail.length === 0) return null;
  return (
    <dl className="hidden print:mt-1 print:grid print:gap-0.5 print:text-[10px]">
      {trail.map((step, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{step.label}</dt>
          <dd className="text-right font-medium">{step.value}</dd>
        </div>
      ))}
    </dl>
  );
}
