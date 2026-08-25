"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "../currency-input";
import type { CustomAdjustmentInput } from "@/lib/settlement/adjustments/custom";
import type { Party, Side } from "@/lib/settlement/types";

export function CustomForm({
  input,
  onPatch,
}: {
  input: CustomAdjustmentInput;
  onPatch: (patch: Partial<CustomAdjustmentInput>) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label className="text-xs">Description</Label>
        <Input value={input.description} onChange={(e) => onPatch({ description: e.target.value })} placeholder="e.g. Pool safety certificate credit" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Amount</Label>
          <CurrencyInput valueCents={input.amountCents} onChangeCents={(c) => onPatch({ amountCents: c })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Party</Label>
          <RadioGroup value={input.party ?? ""} onValueChange={(v) => onPatch({ party: v as Party })}>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="BUYER" /> Buyer
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="SELLER" /> Seller
            </label>
          </RadioGroup>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Debit or credit</Label>
          <RadioGroup value={input.side} onValueChange={(v) => onPatch({ side: v as Side })}>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="DEBIT" /> Debit
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="CREDIT" /> Credit
            </label>
          </RadioGroup>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Reason</Label>
        <Textarea value={input.reason} onChange={(e) => onPatch({ reason: e.target.value })} rows={2} placeholder="Why this adjustment applies." />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Contract/reference (optional)</Label>
          <Input value={input.contractReference} onChange={(e) => onPatch({ contractReference: e.target.value })} placeholder="Special Condition 9" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Notes (optional)</Label>
          <Input value={input.notes} onChange={(e) => onPatch({ notes: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
