"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "../currency-input";
import { RENT_FREQUENCY_LABEL, type RentAdjustmentInput, type RentFrequency } from "@/lib/settlement/adjustments/rent";

export function RentForm({
  input,
  onPatch,
}: {
  input: RentAdjustmentInput;
  onPatch: (patch: Partial<RentAdjustmentInput>) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label className="text-xs">Description (optional)</Label>
        <Input value={input.label} onChange={(e) => onPatch({ label: e.target.value })} placeholder="Rent" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Rent amount (per cycle)</Label>
          <CurrencyInput valueCents={input.rentAmountCents} onChangeCents={(c) => onPatch({ rentAmountCents: c })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Frequency</Label>
          <Select value={input.frequency ?? ""} onValueChange={(v) => onPatch({ frequency: v as RentFrequency })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select…">
                {(v: string) => (v ? RENT_FREQUENCY_LABEL[v as RentFrequency] : "Select…")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RENT_FREQUENCY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Rent period start</Label>
          <Input type="date" value={input.periodStart ?? ""} onChange={(e) => onPatch({ periodStart: e.target.value || null })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Rent period end</Label>
          <Input type="date" value={input.periodEnd ?? ""} onChange={(e) => onPatch({ periodEnd: e.target.value || null })} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Rent paid to date (optional)</Label>
        <Input type="date" value={input.rentPaidToDate ?? ""} onChange={(e) => onPatch({ rentPaidToDate: e.target.value || null })} />
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Has the seller already collected rent for this period?</Label>
        <RadioGroup value={input.collectionStatus ?? ""} onValueChange={(v) => onPatch({ collectionStatus: v as RentAdjustmentInput["collectionStatus"] })}>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="COLLECTED_BY_SELLER" /> Collected by seller
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="NOT_YET_COLLECTED" /> Not yet collected
          </label>
        </RadioGroup>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Reference figure (optional)</Label>
        <CurrencyInput valueCents={input.referenceFigureCents} onChangeCents={(c) => onPatch({ referenceFigureCents: c })} />
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea value={input.notes} onChange={(e) => onPatch({ notes: e.target.value })} rows={2} />
      </div>
    </div>
  );
}
