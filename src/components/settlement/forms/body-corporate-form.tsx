"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "../currency-input";
import { LEVY_TYPE_LABEL, type BodyCorporateAdjustmentInput, type LevyType } from "@/lib/settlement/adjustments/bodyCorporate";

export function BodyCorporateForm({
  input,
  onPatch,
}: {
  input: BodyCorporateAdjustmentInput;
  onPatch: (patch: Partial<BodyCorporateAdjustmentInput>) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Levy type</Label>
          <Select value={input.levyType} onValueChange={(v) => onPatch({ levyType: v as LevyType })}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v: LevyType) => LEVY_TYPE_LABEL[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEVY_TYPE_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Description (optional)</Label>
          <Input value={input.label} onChange={(e) => onPatch({ label: e.target.value })} placeholder={LEVY_TYPE_LABEL[input.levyType]} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={input.noticeNotYetReceived} onCheckedChange={(c) => onPatch({ noticeNotYetReceived: c === true })} />
        Levy notice not yet received
      </label>

      {!input.noticeNotYetReceived && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Levy amount</Label>
              <CurrencyInput valueCents={input.levyAmountCents} onChangeCents={(c) => onPatch({ levyAmountCents: c })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Levy period start</Label>
              <Input type="date" value={input.periodStart ?? ""} onChange={(e) => onPatch({ periodStart: e.target.value || null })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Levy period end</Label>
              <Input type="date" value={input.periodEnd ?? ""} onChange={(e) => onPatch({ periodEnd: e.target.value || null })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={input.noticeConfirmedCurrent} onCheckedChange={(c) => onPatch({ noticeConfirmedCurrent: c === true })} />
            Confirmed this levy notice is current
          </label>

          <div className="grid gap-1.5">
            <Label className="text-xs">Has this levy been paid?</Label>
            <RadioGroup value={input.paymentStatus ?? ""} onValueChange={(v) => onPatch({ paymentStatus: v as BodyCorporateAdjustmentInput["paymentStatus"] })}>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="PAID_BY_SELLER" /> Paid by seller
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="NOT_YET_PAID" /> Not yet paid
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
        </>
      )}
    </div>
  );
}
