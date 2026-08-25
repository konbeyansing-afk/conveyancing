"use client";

/**
 * Automatic/Manual override toggle, shared by every auto-calculating
 * adjustment category. Shows the calculated figure and the override amount
 * side by side once enabled, and requires a reason.
 */

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "./currency-input";
import { formatAUD } from "@/lib/settlement/money";
import type { AdjustmentCalculationResult, ManualOverride } from "@/lib/settlement/types";

export function OverrideControl({
  result,
  override,
  onChange,
}: {
  result: AdjustmentCalculationResult;
  override: ManualOverride;
  onChange: (next: ManualOverride) => void;
}) {
  const automaticAmount = result.automatic?.ledgerEntries[0]?.amountCents ?? null;

  return (
    <div className="grid gap-2 border-t pt-3 print:hidden">
      <RadioGroup
        value={override.enabled ? "manual" : "automatic"}
        onValueChange={(v) => onChange({ ...override, enabled: v === "manual" })}
        className="flex items-center gap-4"
      >
        <label className="flex items-center gap-1.5 text-xs">
          <RadioGroupItem value="automatic" /> Automatic calculation
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <RadioGroupItem value="manual" /> Manual override
        </label>
      </RadioGroup>

      {override.enabled && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Calculated</Label>
            <p className="text-sm font-medium">{automaticAmount !== null ? formatAUD(automaticAmount) : "—"}</p>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Manual override amount</Label>
            <CurrencyInput
              valueCents={override.amountCents}
              onChangeCents={(cents) => onChange({ ...override, amountCents: cents })}
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Reason (required)</Label>
            <Textarea
              value={override.reason}
              onChange={(e) => onChange({ ...override, reason: e.target.value })}
              placeholder="Why this figure differs from the automatic calculation."
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}
