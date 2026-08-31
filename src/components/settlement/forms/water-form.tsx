"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "../currency-input";
import {
  WATER_COMPONENT_LABEL,
  WATER_SOURCE_DOCUMENT_LABEL,
  type WaterAdjustmentInput,
  type WaterCalcMode,
  type WaterComponent,
  type WaterSourceDocument,
  type WaterSourceStatus,
} from "@/lib/settlement/adjustments/water";
import type { Party } from "@/lib/settlement/types";

function isArrearsOrCredit(component: WaterComponent): boolean {
  return component === "ARREARS" || component === "CREDIT";
}

export function WaterForm({
  input,
  onPatch,
}: {
  input: WaterAdjustmentInput;
  onPatch: (patch: Partial<WaterAdjustmentInput>) => void;
}) {
  const arrearsOrCredit = isArrearsOrCredit(input.component);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Component</Label>
          <Select
            value={input.component}
            onValueChange={(v) => {
              const component = v as WaterComponent;
              const nowArrearsOrCredit = isArrearsOrCredit(component);
              onPatch({
                component,
                waterMode: nowArrearsOrCredit
                  ? "ARREARS_CREDIT"
                  : input.waterMode === "ARREARS_CREDIT"
                    ? "FLAT"
                    : input.waterMode,
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(v: WaterComponent) => WATER_COMPONENT_LABEL[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(WATER_COMPONENT_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Description (optional)</Label>
          <Input value={input.label} onChange={(e) => onPatch({ label: e.target.value })} placeholder={WATER_COMPONENT_LABEL[input.component]} />
        </div>
      </div>

      {!arrearsOrCredit && (
        <div className="grid gap-1.5">
          <Label className="text-xs">Calculation method</Label>
          <RadioGroup value={input.waterMode} onValueChange={(v) => onPatch({ waterMode: v as WaterCalcMode })}>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="FLAT" /> Flat notice amount (day-prorated over its actual billing period)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="METERED" /> Metered usage — previous read + special read
            </label>
          </RadioGroup>
        </div>
      )}

      {arrearsOrCredit ? (
        <ArrearsCreditFields input={input} onPatch={onPatch} />
      ) : input.waterMode === "FLAT" ? (
        <FlatFields input={input} onPatch={onPatch} />
      ) : (
        <MeteredFields input={input} onPatch={onPatch} />
      )}

      <BillMetadataFields input={input} onPatch={onPatch} />
    </div>
  );
}

function ArrearsCreditFields({
  input,
  onPatch,
}: {
  input: WaterAdjustmentInput;
  onPatch: (patch: Partial<WaterAdjustmentInput>) => void;
}) {
  const isCredit = input.component === "CREDIT";
  return (
    <>
      <p className="text-xs text-muted-foreground">
        A pre-existing balance, not a period-based charge — never day-prorated. Confirm the responsible/entitled
        party from the actual notice or statement; this is never assumed.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">{isCredit ? "Credit amount" : "Arrears amount"}</Label>
          <CurrencyInput valueCents={input.manualAmountCents} onChangeCents={(c) => onPatch({ manualAmountCents: c })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">{isCredit ? "Owed to" : "Payable by"}</Label>
          <RadioGroup value={input.relatedParty ?? ""} onValueChange={(v) => onPatch({ relatedParty: v as Party })}>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="SELLER" /> Seller
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="BUYER" /> Buyer
            </label>
          </RadioGroup>
        </div>
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
  );
}

/**
 * Bill metadata (spec section 15/21): audit-trail fields only — none of
 * these feed into the calculation, they exist so a later reviewer can see
 * exactly which document a figure came from.
 */
function BillMetadataFields({
  input,
  onPatch,
}: {
  input: WaterAdjustmentInput;
  onPatch: (patch: Partial<WaterAdjustmentInput>) => void;
}) {
  return (
    <details className="rounded-lg border px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Bill details &amp; source (optional)
      </summary>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Water authority</Label>
            <Input value={input.waterAuthority} onChange={(e) => onPatch({ waterAuthority: e.target.value })} placeholder="e.g. Urban Utilities, Sydney Water" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Bill / notice number</Label>
            <Input value={input.noticeNumber} onChange={(e) => onPatch({ noticeNumber: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Issue date</Label>
            <Input type="date" value={input.issueDate ?? ""} onChange={(e) => onPatch({ issueDate: e.target.value || null })} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Due date</Label>
            <Input type="date" value={input.dueDate ?? ""} onChange={(e) => onPatch({ dueDate: e.target.value || null })} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Source document</Label>
            <Select value={input.sourceDocument ?? ""} onValueChange={(v) => onPatch({ sourceDocument: v as WaterSourceDocument })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(WATER_SOURCE_DOCUMENT_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Verification status</Label>
            <Select value={input.sourceStatus} onValueChange={(v) => onPatch({ sourceStatus: v as WaterSourceStatus })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VERIFIED">✓ Verified</SelectItem>
                <SelectItem value="NEEDS_VERIFICATION">⚠ Needs verification</SelectItem>
                <SelectItem value="MISSING">✕ Missing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Total bill amount (optional — for reconciling against every water component on this matter)</Label>
          <CurrencyInput valueCents={input.billTotalCents} onChangeCents={(c) => onPatch({ billTotalCents: c })} />
        </div>
      </div>
    </details>
  );
}

function FlatFields({
  input,
  onPatch,
}: {
  input: WaterAdjustmentInput;
  onPatch: (patch: Partial<WaterAdjustmentInput>) => void;
}) {
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={input.noticeNotYetReceived} onCheckedChange={(c) => onPatch({ noticeNotYetReceived: c === true })} />
        Notice not yet received
      </label>
      {!input.noticeNotYetReceived && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Amount</Label>
              <CurrencyInput valueCents={input.amountCents} onChangeCents={(c) => onPatch({ amountCents: c })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Period start</Label>
              <Input type="date" value={input.periodStart ?? ""} onChange={(e) => onPatch({ periodStart: e.target.value || null })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Period end</Label>
              <Input type="date" value={input.periodEnd ?? ""} onChange={(e) => onPatch({ periodEnd: e.target.value || null })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={input.noticeConfirmedCurrent} onCheckedChange={(c) => onPatch({ noticeConfirmedCurrent: c === true })} />
            Confirmed this notice is current
          </label>
          <div className="grid gap-1.5">
            <Label className="text-xs">Has this been paid?</Label>
            <RadioGroup value={input.paymentStatus ?? ""} onValueChange={(v) => onPatch({ paymentStatus: v as WaterAdjustmentInput["paymentStatus"] })}>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="PAID_BY_SELLER" /> Paid by seller
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="NOT_YET_PAID" /> Not yet paid
              </label>
            </RadioGroup>
          </div>
        </>
      )}
    </>
  );
}

function MeteredFields({
  input,
  onPatch,
}: {
  input: WaterAdjustmentInput;
  onPatch: (patch: Partial<WaterAdjustmentInput>) => void;
}) {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Never invents a reading — if the information below isn&apos;t on the certificate, leave it blank
        and this adjustment will block with an error rather than guess.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={input.noticeConfirmedCurrent} onCheckedChange={(c) => onPatch({ noticeConfirmedCurrent: c === true })} />
        Confirmed these readings match the search certificate/notice
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Previous read date</Label>
          <Input type="date" value={input.previousReadDate ?? ""} onChange={(e) => onPatch({ previousReadDate: e.target.value || null })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Previous reading (kL)</Label>
          <Input type="number" step="0.001" value={input.previousReadingKL ?? ""} onChange={(e) => onPatch({ previousReadingKL: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Special read date</Label>
          <Input type="date" value={input.specialReadDate ?? ""} onChange={(e) => onPatch({ specialReadDate: e.target.value || null })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Special reading (kL)</Label>
          <Input type="number" step="0.001" value={input.specialReadingKL ?? ""} onChange={(e) => onPatch({ specialReadingKL: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Property share of meter (%)</Label>
          <Input type="number" min={1} max={100} value={input.propertySharePercent ?? ""} onChange={(e) => onPatch({ propertySharePercent: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Usage rate ($/kL, from notice)</Label>
          <CurrencyInput valueCents={input.usageRatePerKLCents} onChangeCents={(c) => onPatch({ usageRatePerKLCents: c })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Fixed access charge for this period</Label>
          <CurrencyInput valueCents={input.fixedAccessChargeCents} onChangeCents={(c) => onPatch({ fixedAccessChargeCents: c })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Reference figure (optional)</Label>
          <CurrencyInput valueCents={input.referenceFigureCents} onChangeCents={(c) => onPatch({ referenceFigureCents: c })} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea value={input.notes} onChange={(e) => onPatch({ notes: e.target.value })} rows={2} />
      </div>
    </>
  );
}
