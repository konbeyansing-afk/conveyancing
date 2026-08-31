"use client";

/**
 * Admin/Trainer visibility into a matter's settlement calculation (spec
 * section 26): who created it, who last edited it, who finalised it,
 * status, amount, state, date — plus Reopen, the one action only Admin/
 * Trainer can take (spec section 27).
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAUD } from "@/lib/settlement/money";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { reopenSettlementCalculation } from "@/lib/actions/settlement";

export type SettlementAdminSummaryData = {
  id: string;
  version: number;
  status: "DRAFT" | "FINALISED";
  settlementAmountCents: number | null;
  createdByName: string;
  updatedByName: string | null;
  finalisedByName: string | null;
  finalisedAt: Date | null;
  updatedAt: Date;
};

export function SettlementAdminSummary({
  workItemId,
  data,
  canReopen,
}: {
  workItemId: string;
  data: SettlementAdminSummaryData;
  canReopen: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [reopened, setReopened] = useState(false);

  return (
    <div className="grid gap-2 rounded-lg border px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium text-foreground">
          Settlement Calculation
          <Badge variant={data.status === "FINALISED" ? "default" : "outline"} className="ml-2 text-[0.65rem]">
            {data.status === "FINALISED" ? `Finalised (v${data.version})` : `Draft (v${data.version})`}
          </Badge>
        </p>
        {data.settlementAmountCents !== null && (
          <span className="font-semibold tabular-nums">{formatAUD(data.settlementAmountCents)}</span>
        )}
      </div>
      <div className="grid gap-0.5 text-muted-foreground">
        <span>Created by {data.createdByName}</span>
        {data.updatedByName && <span>Last edited by {data.updatedByName}</span>}
        {data.status === "FINALISED" && data.finalisedByName && data.finalisedAt && (
          <span>
            Finalised by {data.finalisedByName} · {formatRelativeTime(data.finalisedAt)}
          </span>
        )}
        <span>Updated {formatRelativeTime(data.updatedAt)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/va/settlement-calculator/${workItemId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <Eye className="size-3" />
          Review
        </Link>
        {canReopen && data.status === "FINALISED" && !reopened && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[0.7rem]"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await reopenSettlementCalculation(data.id);
                if (result.success) {
                  setReopened(true);
                  toast.success("Calculation reopened as a new draft");
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            <RotateCcw className="size-3" />
            {pending ? "Reopening…" : "Reopen"}
          </Button>
        )}
        {reopened && <span className="text-success">Reopened — refresh to see the new draft.</span>}
      </div>
    </div>
  );
}
