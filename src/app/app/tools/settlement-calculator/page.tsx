"use client";

import { useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calculator,
  CircleAlert,
  Clock,
  Droplet,
  Gauge,
  GraduationCap,
  Landmark,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  calculateSettlement,
  type AdjustmentCategory,
  type AdjustmentItemInput,
  type AdjustmentItemResult,
  type PaymentStatus,
  type WaterCalcMode,
} from "@/lib/settlement-calculator";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<AdjustmentCategory, { label: string; icon: typeof Landmark }> = {
  RATES: { label: "Rates", icon: Landmark },
  WATER: { label: "Water", icon: Droplet },
  BODY_CORPORATE: { label: "Body Corporate", icon: Building2 },
  OTHER: { label: "Other", icon: CircleAlert },
};

function newItem(category: AdjustmentCategory): AdjustmentItemInput {
  return {
    id: crypto.randomUUID(),
    category,
    label: "",
    amount: null,
    periodStart: null,
    periodEnd: null,
    noticeConfirmedCurrent: false,
    noticeNotYetReceived: false,
    paymentStatus: null,
    pexaFigure: null,
    waterMode: category === "WATER" ? "FLAT" : undefined,
    previousReadDate: null,
    previousReading: null,
    specialReadDate: null,
    specialReading: null,
    propertySharePercent: null,
    usageRatePerKL: null,
    accessCharge: null,
  };
}

function money(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function kl(n: number | null): string {
  if (n === null) return "—";
  return `${n.toLocaleString("en-AU", { maximumFractionDigits: 3 })} kL`;
}

export default function SettlementCalculatorPage() {
  const [settlementDate, setSettlementDate] = useState<string>("");
  const [items, setItems] = useState<AdjustmentItemInput[]>([]);
  const [showExplanations, setShowExplanations] = useState(true);
  const [outOfScopeFlags, setOutOfScopeFlags] = useState({
    newResidential: false,
    commercial: false,
    gstRegisteredVendor: false,
    landTaxSpecialCondition: false,
  });
  const [contractPriceStr, setContractPriceStr] = useState("");
  const [depositPaidStr, setDepositPaidStr] = useState("");

  const contractPrice = contractPriceStr.trim() === "" ? null : Number(contractPriceStr);
  const depositPaid = depositPaidStr.trim() === "" ? null : Number(depositPaidStr);

  const output = useMemo(
    () =>
      calculateSettlement({
        settlementDate: settlementDate || null,
        items,
        contractPrice: contractPrice !== null && !Number.isNaN(contractPrice) ? contractPrice : null,
        depositPaid: depositPaid !== null && !Number.isNaN(depositPaid) ? depositPaid : null,
      }),
    [settlementDate, items, contractPrice, depositPaid]
  );

  const resultsById = new Map(output.results.map((r) => [r.id, r]));

  function updateItem(id: string, patch: Partial<AdjustmentItemInput>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const anyOutOfScopeFlag = Object.values(outOfScopeFlags).some(Boolean);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Calculator className="size-6 text-primary" />
          Settlement Adjustment Calculator
        </h1>
        <p className="text-muted-foreground">
          QLD rates, water &amp; body corporate proration for settlement — with the working shown so a
          supervisor can spot-check it.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Every figure below is a <strong>working draft</strong>. It does not replace your supervising
          solicitor/conveyancer&apos;s sign-off — don&apos;t put anything from this tool into a settlement
          statement or PEXA without their review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleAlert className="size-4 text-muted-foreground" />
            Not calculated here
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Transfer (stamp) duty</strong> — a separate cost to the
              buyer, not a settlement adjustment.
            </li>
            <li>
              <strong className="text-foreground">Land tax</strong> — not adjusted under the standard REIQ
              contract unless a special condition requires it.
            </li>
            <li>
              <strong className="text-foreground">GST</strong> — out of scope for standard residential
              resale.
            </li>
          </ul>
          <div className="grid gap-2 border-t pt-3">
            <p className="text-sm font-medium">Does this file involve any of the following?</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={outOfScopeFlags.newResidential}
                onCheckedChange={(checked) =>
                  setOutOfScopeFlags((f) => ({ ...f, newResidential: checked === true }))
                }
              />
              New residential premises
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={outOfScopeFlags.commercial}
                onCheckedChange={(checked) =>
                  setOutOfScopeFlags((f) => ({ ...f, commercial: checked === true }))
                }
              />
              Commercial property
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={outOfScopeFlags.gstRegisteredVendor}
                onCheckedChange={(checked) =>
                  setOutOfScopeFlags((f) => ({ ...f, gstRegisteredVendor: checked === true }))
                }
              />
              GST-registered vendor
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={outOfScopeFlags.landTaxSpecialCondition}
                onCheckedChange={(checked) =>
                  setOutOfScopeFlags((f) => ({ ...f, landTaxSpecialCondition: checked === true }))
                }
              />
              Special condition requiring a land tax adjustment
            </label>
          </div>
          {anyOutOfScopeFlag && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                Stop — flag this file for your supervising solicitor/conveyancer before proceeding. This
                calculator doesn&apos;t handle duty, land tax, or GST scenarios.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="settlement-date">Settlement date</Label>
            <Input
              id="settlement-date"
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={showExplanations} onCheckedChange={(c) => setShowExplanations(c === true)} />
              <GraduationCap className="size-4 text-muted-foreground" />
              Show extra explanations (recommended if you&apos;re new to settlement adjustments)
            </label>
          </div>
        </CardContent>
      </Card>

      {showExplanations && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <strong className="text-foreground">Why the split works this way:</strong> the seller is
          liable for rates/water/body corporate charges up to and including the settlement date; the
          buyer becomes liable from the day after. Whoever already paid the notice gets reimbursed by
          the other party for their share — that&apos;s the &quot;credit&quot; below.
        </p>
      )}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">Adjustment items</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_META) as AdjustmentCategory[]).map((cat) => (
              <Button
                key={cat}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((prev) => [...prev, newItem(cat)])}
              >
                <Plus data-icon="inline-start" />
                {CATEGORY_META[cat].label}
              </Button>
            ))}
          </div>
        </div>

        {items.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No adjustment items yet — add rates, water, or body corporate above. Add each notice
              separately (e.g. admin fund and sinking fund body corporate levies aren&apos;t merged).
            </CardContent>
          </Card>
        )}

        {items.map((item) => (
          <AdjustmentItemCard
            key={item.id}
            item={item}
            result={resultsById.get(item.id)}
            showExplanations={showExplanations}
            onChange={(patch) => updateItem(item.id, patch)}
            onRemove={() => removeItem(item.id)}
          />
        ))}
      </div>

      {items.length > 0 && (
        <SummaryCard
          settlementDateError={output.settlementDateError}
          totalCreditToBuyer={output.totalCreditToBuyer}
          totalCreditToSeller={output.totalCreditToSeller}
          netToBuyer={output.netToBuyer}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Balance purchase price (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Only enter these if the VA has confirmed them — never assumed or estimated.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="contract-price">Contract price</Label>
              <Input
                id="contract-price"
                type="number"
                step="0.01"
                placeholder="e.g. 650000.00"
                value={contractPriceStr}
                onChange={(e) => setContractPriceStr(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="deposit-paid">Deposit paid</Label>
              <Input
                id="deposit-paid"
                type="number"
                step="0.01"
                placeholder="e.g. 65000.00"
                value={depositPaidStr}
                onChange={(e) => setDepositPaidStr(e.target.value)}
              />
            </div>
          </div>
          {output.balancePurchasePrice !== null ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="text-muted-foreground">
                Contract price {money(contractPrice)} − deposit {money(depositPaid)}
                {output.netToBuyer >= 0
                  ? ` − net credit to buyer ${money(Math.abs(output.netToBuyer))}`
                  : ` + net credit to seller ${money(Math.abs(output.netToBuyer))}`}
              </p>
              <p className="mt-1 text-base font-semibold">
                Balance purchase price: {money(output.balancePurchasePrice)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{output.balanceUnavailableReason}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdjustmentItemCard({
  item,
  result,
  showExplanations,
  onChange,
  onRemove,
}: {
  item: AdjustmentItemInput;
  result: AdjustmentItemResult | undefined;
  showExplanations: boolean;
  onChange: (patch: Partial<AdjustmentItemInput>) => void;
  onRemove: () => void;
}) {
  const meta = CATEGORY_META[item.category];
  const Icon = meta.icon;
  const idPrefix = useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-primary" />
            {meta.label}
          </span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove item">
            <Trash2 className="size-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-label`}>
            Label <span className="font-normal text-muted-foreground">(optional — e.g. Admin Fund, Sinking Fund, Special Levy)</span>
          </Label>
          <Input
            id={`${idPrefix}-label`}
            value={item.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={meta.label === "Body Corporate" ? "e.g. Admin Fund" : ""}
          />
        </div>

        {item.category === "WATER" && (
          <div className="grid gap-1.5">
            <Label>Calculation method</Label>
            <RadioGroup
              value={item.waterMode ?? "FLAT"}
              onValueChange={(v) => onChange({ waterMode: v as WaterCalcMode })}
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="FLAT" />
                Flat notice amount (same as rates)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="METERED" />
                Metered usage — special meter read (recommended for retailers like Unitywater/Urban
                Utilities)
              </label>
            </RadioGroup>
            {showExplanations && item.waterMode === "METERED" && (
              <p className="text-xs text-muted-foreground">
                Water usage isn&apos;t fixed like rates, so instead of prorating a flat amount, this
                estimates real unbilled usage from the last two meter readings. The fixed access charge
                still just prorates by day — only usage is estimated from consumption. The whole
                unbilled amount is the seller&apos;s (it&apos;s all pre-settlement), so it&apos;s always a
                credit to the buyer, not a day-split.
              </p>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={item.noticeNotYetReceived}
            onCheckedChange={(c) => onChange({ noticeNotYetReceived: c === true })}
          />
          {item.category === "WATER" && item.waterMode === "METERED"
            ? "Special meter read not yet available"
            : "Notice not yet received"}
        </label>

        {item.noticeNotYetReceived ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" />
            {item.category === "WATER" && item.waterMode === "METERED"
              ? "Pending — cannot calculate until the special meter read is available."
              : "Pending — cannot calculate until the notice is received."}
          </div>
        ) : item.category === "WATER" && item.waterMode === "METERED" ? (
          <MeteredWaterFields item={item} idPrefix={idPrefix} onChange={onChange} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`${idPrefix}-amount`}>Notice amount</Label>
                <Input
                  id={`${idPrefix}-amount`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={item.amount ?? ""}
                  onChange={(e) =>
                    onChange({ amount: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${idPrefix}-start`}>Period start</Label>
                <Input
                  id={`${idPrefix}-start`}
                  type="date"
                  value={item.periodStart ?? ""}
                  onChange={(e) => onChange({ periodStart: e.target.value || null })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${idPrefix}-end`}>Period end</Label>
                <Input
                  id={`${idPrefix}-end`}
                  type="date"
                  value={item.periodEnd ?? ""}
                  onChange={(e) => onChange({ periodEnd: e.target.value || null })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={item.noticeConfirmedCurrent}
                onCheckedChange={(c) => onChange({ noticeConfirmedCurrent: c === true })}
              />
              I confirm this notice is current (not superseded)
            </label>

            <div className="grid gap-1.5">
              <Label>Has this already been paid?</Label>
              <RadioGroup
                value={item.paymentStatus ?? ""}
                onValueChange={(v) => onChange({ paymentStatus: v as PaymentStatus })}
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="PAID_BY_SELLER" />
                  Already paid in full by the seller
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="NOT_YET_PAID" />
                  Not yet paid (will be paid in full after settlement)
                </label>
              </RadioGroup>
              {showExplanations && (
                <p className="text-xs text-muted-foreground">
                  This decides who gets credited: if the seller already paid, the buyer owes the seller
                  for their share — a credit to the seller. If it&apos;s unpaid, the seller owes the buyer
                  for their share — a credit to the buyer.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`${idPrefix}-pexa`}>
                PEXA figure to reconcile against{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${idPrefix}-pexa`}
                type="number"
                step="0.01"
                placeholder="0.00"
                value={item.pexaFigure ?? ""}
                onChange={(e) =>
                  onChange({ pexaFigure: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </div>
          </>
        )}

        <ItemResult result={result} />
      </CardContent>
    </Card>
  );
}

function MeteredWaterFields({
  item,
  idPrefix,
  onChange,
}: {
  item: AdjustmentItemInput;
  idPrefix: string;
  onChange: (patch: Partial<AdjustmentItemInput>) => void;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-prev-date`}>Previous read date</Label>
          <Input
            id={`${idPrefix}-prev-date`}
            type="date"
            value={item.previousReadDate ?? ""}
            onChange={(e) => onChange({ previousReadDate: e.target.value || null })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-prev-reading`}>Previous reading (kL)</Label>
          <Input
            id={`${idPrefix}-prev-reading`}
            type="number"
            step="0.001"
            placeholder="0.000"
            value={item.previousReading ?? ""}
            onChange={(e) =>
              onChange({ previousReading: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-special-date`}>Special read date</Label>
          <Input
            id={`${idPrefix}-special-date`}
            type="date"
            value={item.specialReadDate ?? ""}
            onChange={(e) => onChange({ specialReadDate: e.target.value || null })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-special-reading`}>Special reading (kL)</Label>
          <Input
            id={`${idPrefix}-special-reading`}
            type="number"
            step="0.001"
            placeholder="0.000"
            value={item.specialReading ?? ""}
            onChange={(e) =>
              onChange({ specialReading: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-share`}>
            Property share <span className="font-normal text-muted-foreground">(%, 100 if not shared)</span>
          </Label>
          <Input
            id={`${idPrefix}-share`}
            type="number"
            step="1"
            placeholder="100"
            value={item.propertySharePercent ?? ""}
            onChange={(e) =>
              onChange({ propertySharePercent: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-usage-rate`}>Usage rate ($/kL)</Label>
          <Input
            id={`${idPrefix}-usage-rate`}
            type="number"
            step="0.0001"
            placeholder="0.00"
            value={item.usageRatePerKL ?? ""}
            onChange={(e) =>
              onChange({ usageRatePerKL: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-access-charge`}>Fixed access charge for this period</Label>
          <Input
            id={`${idPrefix}-access-charge`}
            type="number"
            step="0.01"
            placeholder="0.00"
            value={item.accessCharge ?? ""}
            onChange={(e) =>
              onChange({ accessCharge: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={item.noticeConfirmedCurrent}
          onCheckedChange={(c) => onChange({ noticeConfirmedCurrent: c === true })}
        />
        I confirm these readings match the search certificate/notice
      </label>

      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-pexa`}>
          PEXA figure to reconcile against <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${idPrefix}-pexa`}
          type="number"
          step="0.01"
          placeholder="0.00"
          value={item.pexaFigure ?? ""}
          onChange={(e) => onChange({ pexaFigure: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </div>
    </>
  );
}

function ItemResult({ result }: { result: AdjustmentItemResult | undefined }) {
  if (!result || result.pending) return null;

  return (
    <div className="grid gap-2 border-t pt-3">
      {result.blockingErrors.map((err, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {err}
        </div>
      ))}
      {result.warnings.map((warn, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {warn}
        </div>
      ))}
      {result.periodTotalDays !== null && (
        <p className="text-xs text-muted-foreground">
          {result.periodTotalDays} days in period · daily rate {money(result.dailyRate)}
        </p>
      )}
      {result.sellerDays !== null && result.buyerDays !== null && (
        <p className="text-xs text-muted-foreground">
          Seller: {result.sellerDays} days ({money(result.sellerShare)}) · Buyer: {result.buyerDays} days (
          {money(result.buyerShare)})
        </p>
      )}
      {result.meteredTotalUsageKL !== null && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Gauge className="size-3.5 shrink-0" />
          Estimated unbilled usage: {kl(result.meteredTotalUsageKL)} (avg {result.meteredAvgDailyUsageL} L/day)
        </p>
      )}
      {result.meteredUsageCharge !== null && result.meteredAccessCharge !== null && (
        <p className="text-xs text-muted-foreground">
          Usage charge {money(result.meteredUsageCharge)} + access charge {money(result.meteredAccessCharge)}
        </p>
      )}
      {result.creditTo && result.creditAmount !== null && (
        <p className={cn("text-sm font-semibold", result.creditTo === "buyer" ? "text-emerald-600 dark:text-emerald-400" : "text-primary")}>
          Credit to {result.creditTo}: {money(result.creditAmount)}
        </p>
      )}
    </div>
  );
}

function SummaryCard({
  settlementDateError,
  totalCreditToBuyer,
  totalCreditToSeller,
  netToBuyer,
}: {
  settlementDateError: string | null;
  totalCreditToBuyer: number;
  totalCreditToSeller: number;
  netToBuyer: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {settlementDateError && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {settlementDateError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Total credit to buyer</p>
            <p className="text-lg font-semibold">{money(totalCreditToBuyer)}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Total credit to seller</p>
            <p className="text-lg font-semibold">{money(totalCreditToSeller)}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="text-lg font-semibold">
              {money(Math.abs(netToBuyer))} to {netToBuyer >= 0 ? "buyer" : "seller"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
