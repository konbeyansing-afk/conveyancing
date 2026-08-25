"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "../currency-input";
import { RATES_CHARGE_TYPE_LABEL, type RatesAdjustmentInput, type RatesChargeType } from "@/lib/settlement/adjustments/rates";

export function RatesForm({
  input,
  onPatch,
}: {
  input: RatesAdjustmentInput;
  onPatch: (patch: Partial<RatesAdjustmentInput>) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Charge type</Label>
          <Select value={input.chargeType} onValueChange={(v) => onPatch({ chargeType: v as RatesChargeType })}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v: RatesChargeType) => RATES_CHARGE_TYPE_LABEL[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RATES_CHARGE_TYPE_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Description (optional)</Label>
          <Input value={input.label} onChange={(e) => onPatch({ label: e.target.value })} placeholder={RATES_CHARGE_TYPE_LABEL[input.chargeType]} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={input.noticeNotYetReceived} onCheckedChange={(c) => onPatch({ noticeNotYetReceived: c === true })} />
        Notice not yet received
      </label>

      {!input.noticeNotYetReceived && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Assessment amount</Label>
              <CurrencyInput valueCents={input.assessmentAmountCents} onChangeCents={(c) => onPatch({ assessmentAmountCents: c })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Assessment start</Label>
              <Input type="date" value={input.periodStart ?? ""} onChange={(e) => onPatch({ periodStart: e.target.value || null })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Assessment end</Label>
              <Input type="date" value={input.periodEnd ?? ""} onChange={(e) => onPatch({ periodEnd: e.target.value || null })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={input.noticeConfirmedCurrent} onCheckedChange={(c) => onPatch({ noticeConfirmedCurrent: c === true })} />
            Confirmed this notice is current (not superseded)
          </label>

          <div className="grid gap-1.5">
            <Label className="text-xs">Has this been paid?</Label>
            <RadioGroup value={input.paymentStatus ?? ""} onValueChange={(v) => onPatch({ paymentStatus: v as RatesAdjustmentInput["paymentStatus"] })}>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="PAID_BY_SELLER" /> Paid by seller
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="NOT_YET_PAID" /> Not yet paid
              </label>
            </RadioGroup>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Reference figure (optional — e.g. from PEXA)</Label>
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
