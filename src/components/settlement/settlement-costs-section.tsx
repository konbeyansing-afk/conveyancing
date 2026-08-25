"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "./currency-input";
import { BUYER_COST_LABEL, SELLER_COST_LABEL } from "@/lib/settlement/costs";
import { useSettlement } from "@/lib/settlement/store";
import type { BuyerCosts, SellerCosts } from "@/lib/settlement/types";

export function SettlementCostsSection() {
  const { state, dispatch } = useSettlement();
  const { costs } = state;

  const setBuyer = (patch: Partial<BuyerCosts>) => dispatch({ type: "SET_BUYER_COST", patch });
  const setSeller = (patch: Partial<SellerCosts>) => dispatch({ type: "SET_SELLER_COST", patch });

  return (
    <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
      <Card className="print:border-none print:shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Buyer Costs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(Object.keys(BUYER_COST_LABEL) as (keyof typeof BUYER_COST_LABEL)[]).map((key) => (
            <div key={key} className="grid gap-1.5">
              <Label className="text-xs">{BUYER_COST_LABEL[key]}</Label>
              <CurrencyInput valueCents={costs.buyer[key]} onChangeCents={(c) => setBuyer({ [key]: c })} />
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label className="text-xs">Other costs note</Label>
            <Input value={costs.buyer.otherCostsNote} onChange={(e) => setBuyer({ otherCostsNote: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card className="print:border-none print:shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Seller Costs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(Object.keys(SELLER_COST_LABEL) as (keyof typeof SELLER_COST_LABEL)[]).map((key) => (
            <div key={key} className="grid gap-1.5">
              <Label className="text-xs">{SELLER_COST_LABEL[key]}</Label>
              <CurrencyInput valueCents={costs.seller[key]} onChangeCents={(c) => setSeller({ [key]: c })} />
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label className="text-xs">Other costs note</Label>
            <Input value={costs.seller.otherCostsNote} onChange={(e) => setSeller({ otherCostsNote: e.target.value })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
