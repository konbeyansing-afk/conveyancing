"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAUD } from "@/lib/settlement/money";
import { useSettlementStatement } from "./use-settlement-statement";

export function CalculationSummary() {
  const { statement } = useSettlementStatement();

  return (
    <div className="grid gap-3 sm:grid-cols-2 print:hidden">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Buyer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <Row label="Debits" value={formatAUD(sumSide(statement.buyer.lines, "DEBIT"))} />
          <Row label="Credits" value={formatAUD(sumSide(statement.buyer.lines, "CREDIT"))} />
          <Row label="Balance required" value={formatAUD(statement.buyer.balanceRequiredCents)} strong />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Seller</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <Row label="Credits" value={formatAUD(sumSide(statement.seller.lines, "CREDIT"))} />
          <Row label="Debits" value={formatAUD(sumSide(statement.seller.lines, "DEBIT"))} />
          <Row label="Net proceeds" value={formatAUD(statement.seller.netProceedsCents)} strong />
        </CardContent>
      </Card>
    </div>
  );
}

function sumSide(lines: { side: "DEBIT" | "CREDIT"; amountCents: number }[], side: "DEBIT" | "CREDIT"): number {
  return lines.filter((l) => l.side === side).reduce((sum, l) => sum + l.amountCents, 0);
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-baseline justify-between border-t pt-1.5 font-semibold" : "flex items-baseline justify-between text-muted-foreground"}>
      <span>{label}</span>
      <span className={strong ? "text-foreground" : ""}>{value}</span>
    </div>
  );
}
