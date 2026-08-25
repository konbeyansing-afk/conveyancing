"use client";

import { TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAUD } from "@/lib/settlement/money";
import { formatAuDate } from "@/lib/settlement/dates";
import { useSettlement } from "@/lib/settlement/store";
import { useSettlementStatement } from "./use-settlement-statement";
import type { StatementLine } from "@/lib/settlement/types";

export function SettlementStatementView() {
  const { state } = useSettlement();
  const { statement } = useSettlementStatement();

  return (
    <div id="settlement-statement-print" className="grid gap-3">
      <div className="hidden print:block">
        <h2 className="text-lg font-semibold">Settlement Statement</h2>
        <p className="text-xs text-muted-foreground">
          {state.matter.propertyAddress || "—"} · {state.matter.transactionType === "SALE" ? "Sale" : "Purchase"} ·
          Settlement {formatAuDate(state.matter.settlementDate)} ·{" "}
          {/* Genuinely differs between server render and client hydration by design — this is a live "prepared at" stamp, not a bug. */}
          <span suppressHydrationWarning>Prepared {new Date().toLocaleString("en-AU")}</span>
        </p>
      </div>

      {!statement.balanceCheck.reconciles && (
        <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">This statement does not balance.</p>
            <p className="text-xs">{statement.balanceCheck.detail}</p>
          </div>
        </div>
      )}

      {statement.messages.map((m, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive print:hidden">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {m.text}
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        <StatementTable title="Buyer" lines={statement.buyer.lines} totalLabel="Balance required" totalCents={statement.buyer.balanceRequiredCents} />
        <StatementTable title="Seller" lines={statement.seller.lines} totalLabel="Net settlement proceeds" totalCents={statement.seller.netProceedsCents} />
      </div>
    </div>
  );
}

function StatementTable({
  title,
  lines,
  totalLabel,
  totalCents,
}: {
  title: string;
  lines: StatementLine[];
  totalLabel: string;
  totalCents: number;
}) {
  return (
    <Card className="print:border print:shadow-none">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 font-medium">Description</th>
                <th className="py-1.5 text-right font-medium">Debit</th>
                <th className="py-1.5 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-xs text-muted-foreground">
                    Nothing entered yet.
                  </td>
                </tr>
              )}
              {lines.map((line, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="py-1.5 pr-2">{line.description}</td>
                  <td className="py-1.5 text-right tabular-nums">{line.side === "DEBIT" ? formatAUD(line.amountCents) : ""}</td>
                  <td className="py-1.5 text-right tabular-nums">{line.side === "CREDIT" ? formatAUD(line.amountCents) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2">{totalLabel}</td>
                <td colSpan={2} className="py-2 text-right tabular-nums">{formatAUD(totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
