"use client";

import { ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "../currency-input";
import type { LandTaxAdjustmentInput } from "@/lib/settlement/adjustments/landTax";
import type { Party } from "@/lib/settlement/types";

export function LandTaxForm({
  input,
  onPatch,
}: {
  input: LandTaxAdjustmentInput;
  onPatch: (patch: Partial<LandTaxAdjustmentInput>) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Land tax is never calculated automatically here. Whether an adjustment applies at all depends
          on the contract&apos;s special conditions and the parties&apos; actual circumstances — confirm
          the treatment before entering anything below.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Description (optional)</Label>
        <Input value={input.label} onChange={(e) => onPatch({ label: e.target.value })} placeholder="Land Tax" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Land tax amount (informational)</Label>
          <CurrencyInput valueCents={input.landTaxAmountCents} onChangeCents={(c) => onPatch({ landTaxAmountCents: c })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Financial year</Label>
          <Input value={input.financialYear} onChange={(e) => onPatch({ financialYear: e.target.value })} placeholder="2026-27" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Contract treatment</Label>
        <Textarea
          value={input.contractTreatmentNotes}
          onChange={(e) => onPatch({ contractTreatmentNotes: e.target.value })}
          placeholder="What the contract's special conditions say about land tax, if anything."
          rows={2}
        />
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Does an adjustment apply?</Label>
        <RadioGroup
          value={input.adjustmentApplicable === null ? "" : input.adjustmentApplicable ? "yes" : "no"}
          onValueChange={(v) => onPatch({ adjustmentApplicable: v === "yes" })}
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="yes" /> Yes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="no" /> No
          </label>
        </RadioGroup>
      </div>

      {input.adjustmentApplicable && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Manual adjustment amount</Label>
              <CurrencyInput valueCents={input.manualAdjustmentCents} onChangeCents={(c) => onPatch({ manualAdjustmentCents: c })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Bears the adjustment</Label>
              <RadioGroup value={input.debitParty ?? ""} onValueChange={(v) => onPatch({ debitParty: v as Party })}>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="BUYER" /> Buyer
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="SELLER" /> Seller
                </label>
              </RadioGroup>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={input.notes} onChange={(e) => onPatch({ notes: e.target.value })} rows={2} />
          </div>
        </>
      )}
    </div>
  );
}
