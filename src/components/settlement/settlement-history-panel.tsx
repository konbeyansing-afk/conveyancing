import Link from "next/link";
import { CheckCircle2, FileEdit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAUD } from "@/lib/settlement/money";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type SettlementHistoryEntry = {
  id: string;
  version: number;
  status: "DRAFT" | "FINALISED";
  settlementAmountCents: number | null;
  createdAt: Date;
  createdByName: string;
  finalisedAt: Date | null;
  finalisedByName: string | null;
};

/**
 * "Settlement Calculations" version history (spec section 21) — every
 * version ever created for this matter, most recent first. A finalised
 * version is never overwritten (see finaliseSettlementCalculation), so
 * this list is a permanent record, not a reconstruction.
 */
export function SettlementHistoryPanel({ workItemId, entries }: { workItemId: string; entries: SettlementHistoryEntry[] }) {
  if (entries.length <= 1) return null;

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-sm">Settlement Calculations</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              {entry.status === "FINALISED" ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <FileEdit className="size-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  Version {entry.version}
                  <Badge variant={entry.status === "FINALISED" ? "default" : "outline"} className="ml-2 text-[0.65rem]">
                    {entry.status === "FINALISED" ? "Finalised" : "Draft"}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.status === "FINALISED"
                    ? `Finalised ${entry.finalisedAt ? formatRelativeTime(entry.finalisedAt) : ""} by ${entry.finalisedByName}`
                    : `Created ${formatRelativeTime(entry.createdAt)} by ${entry.createdByName}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {entry.settlementAmountCents !== null && (
                <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatAUD(entry.settlementAmountCents)}</span>
              )}
              {entry.status === "FINALISED" && (
                <Link href={`/va/settlement-calculator/${workItemId}/history/${entry.id}`} className="text-xs text-primary hover:underline">
                  View
                </Link>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
