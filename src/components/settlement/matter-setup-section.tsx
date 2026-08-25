"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CurrencyInput } from "./currency-input";
import { useSettlement } from "@/lib/settlement/store";
import type { TransactionType } from "@/lib/settlement/types";

export function MatterSetupSection() {
  const { state, dispatch } = useSettlement();
  const { matter } = state;
  const set = (patch: Partial<typeof matter>) => dispatch({ type: "SET_MATTER_FIELD", patch });

  const priceLabel = matter.transactionType === "SALE" ? "Sale price" : "Contract price";

  return (
    <Card className="print:border-none print:shadow-none">
      <CardHeader>
        <CardTitle>Matter Details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5 print:hidden">
          <Label className="text-xs">Transaction type</Label>
          <RadioGroup
            value={matter.transactionType}
            onValueChange={(v) => set({ transactionType: v as TransactionType })}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="PURCHASE" /> Purchase
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="SALE" /> Sale
            </label>
          </RadioGroup>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs">Property address</Label>
          <Input value={matter.propertyAddress} onChange={(e) => set({ propertyAddress: e.target.value })} placeholder="12 Example Street, Suburb QLD 4000" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Contract date</Label>
            <Input type="date" value={matter.contractDate ?? ""} onChange={(e) => set({ contractDate: e.target.value || null })} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Settlement date</Label>
            <Input type="date" value={matter.settlementDate ?? ""} onChange={(e) => set({ settlementDate: e.target.value || null })} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">{priceLabel}</Label>
            <CurrencyInput valueCents={matter.contractPriceCents} onChangeCents={(c) => set({ contractPriceCents: c })} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Deposit paid</Label>
            <CurrencyInput valueCents={matter.depositPaidCents} onChangeCents={(c) => set({ depositPaidCents: c })} />
          </div>
          <div className="grid gap-1.5 print:hidden">
            <Label className="text-xs">Loan proceeds</Label>
            <CurrencyInput valueCents={matter.loanProceedsCents} onChangeCents={(c) => set({ loanProceedsCents: c })} disabled={matter.transactionType === "SALE"} />
          </div>
          <div className="grid gap-1.5 print:hidden">
            <Label className="text-xs">Other client funds</Label>
            <CurrencyInput valueCents={matter.clientFundsCents} onChangeCents={(c) => set({ clientFundsCents: c })} disabled={matter.transactionType === "SALE"} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
