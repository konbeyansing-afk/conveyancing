"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { MatterProgressSummary } from "@/lib/va-dashboard";
import type { ProgressSummary } from "@/lib/checklist";

/**
 * "Production Progress" — the spec's "Training Progress" card, reinterpreted
 * for a VA's real domain: the percentage of required checklist tasks
 * Completed/Not Applicable across every one of the VA's currently open
 * matters (see summarizeMatterProgress). Never a fabricated/averaged
 * figure — the caption always says exactly what's being counted.
 */
export function ProductionProgressCard({
  overall,
  byMatter,
}: {
  overall: ProgressSummary;
  byMatter: MatterProgressSummary[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (overall.total === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-primary" />
          Production Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-end justify-between">
          <p className="text-3xl font-semibold">{overall.percent}%</p>
          <p className="text-sm text-muted-foreground">
            {overall.completed} of {overall.total} required checklist tasks complete across {byMatter.length}{" "}
            open matter{byMatter.length === 1 ? "" : "s"}
          </p>
        </div>
        <Progress value={overall.percent} />

        {byMatter.length > 1 && (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {expanded ? "Hide" : "Show"} by matter
            </Button>
            {expanded && (
              <div className="mt-2 grid gap-1.5">
                {byMatter.map((m) => (
                  <div key={m.matterId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-muted-foreground">{m.matterTitle}</span>
                    <span className="shrink-0 font-medium">
                      {m.completed}/{m.total} ({m.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
