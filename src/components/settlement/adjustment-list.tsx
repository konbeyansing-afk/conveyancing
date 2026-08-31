"use client";

import { Landmark, Droplet, Building2, KeyRound, ShieldAlert, FileEdit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettlement } from "@/lib/settlement/store";
import { computeAdjustmentResults } from "@/lib/settlement/compute";
import { jurisdictionCategoryLabel } from "@/lib/settlement/jurisdiction-labels";
import { isValidIsoDate } from "@/lib/settlement/dates";
import { prorateByPeriod } from "@/lib/settlement/proration";
import { reconcileWaterBillTotal } from "@/lib/settlement/adjustments/water";
import type { AdjustmentCategory } from "@/lib/settlement/types";
import type { Jurisdiction } from "@prisma/client";
import type { RatesAdjustmentInput } from "@/lib/settlement/adjustments/rates";
import type { BodyCorporateAdjustmentInput } from "@/lib/settlement/adjustments/bodyCorporate";
import type { WaterAdjustmentInput } from "@/lib/settlement/adjustments/water";
import type { RentAdjustmentInput } from "@/lib/settlement/adjustments/rent";
import type { LandTaxAdjustmentInput } from "@/lib/settlement/adjustments/landTax";
import type { CustomAdjustmentInput } from "@/lib/settlement/adjustments/custom";
import { AdjustmentCard } from "./adjustment-card";
import { RatesForm } from "./forms/rates-form";
import { BodyCorporateForm } from "./forms/body-corporate-form";
import { WaterForm } from "./forms/water-form";
import { WaterTimeline } from "./water-timeline";
import { WaterStatusLine } from "./water-status-line";
import { WaterTrainingNotes } from "./water-training-notes";
import { WaterReconciliationPanel } from "./water-reconciliation-panel";
import { RentForm } from "./forms/rent-form";
import { LandTaxForm } from "./forms/land-tax-form";
import { CustomForm } from "./forms/custom-form";

const ADD_BUTTONS: { category: AdjustmentCategory; icon: typeof Landmark }[] = [
  { category: "RATES", icon: Landmark },
  { category: "WATER", icon: Droplet },
  { category: "BODY_CORPORATE", icon: Building2 },
  { category: "RENT", icon: KeyRound },
  { category: "LAND_TAX", icon: ShieldAlert },
  { category: "CUSTOM", icon: FileEdit },
];

/**
 * `jurisdiction` is optional and purely cosmetic (see jurisdiction-labels.ts)
 * — omitted, this renders exactly as it always has for the standalone
 * practice tool at /app/tools/settlement-calculator.
 */
export function AdjustmentList({
  jurisdiction = null,
  trainingMode = false,
}: { jurisdiction?: Jurisdiction | null; trainingMode?: boolean } = {}) {
  const { state, dispatch } = useSettlement();
  const settlementDate = state.matter.settlementDate;
  const results = computeAdjustmentResults(state.adjustments, { settlementDate });
  const resultsById = new Map(results.map((r) => [r.id, r]));

  const waterItems = state.adjustments.filter((i): i is Extract<typeof i, { category: "WATER" }> => i.category === "WATER");
  const waterReconciliation =
    waterItems.length > 0 ? reconcileWaterBillTotal(waterItems.map((i) => i.input), resultsById) : null;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 print:hidden">
        {ADD_BUTTONS.map(({ category, icon: Icon }) => (
          <Button key={category} variant="outline" size="sm" onClick={() => dispatch({ type: "ADD_ADJUSTMENT", category })}>
            <Plus className="size-3.5" />
            <Icon className="size-3.5" />
            {jurisdictionCategoryLabel(jurisdiction, category)}
          </Button>
        ))}
      </div>

      <WaterReconciliationPanel reconciliation={waterReconciliation} />

      {state.adjustments.length === 0 && (
        <p className="text-sm text-muted-foreground print:hidden">No adjustments added yet.</p>
      )}

      <div className="grid gap-3">
        {state.adjustments.map((item) => {
          const onRemove = () => dispatch({ type: "REMOVE_ADJUSTMENT", id: item.id });

          switch (item.category) {
            case "RATES": {
              const result = resultsById.get(item.id)!;
              const onPatch = (patch: Partial<RatesAdjustmentInput>) => dispatch({ type: "UPDATE_ADJUSTMENT", id: item.id, patch });
              return (
                <AdjustmentCard
                  key={item.id}
                  title={item.input.label || "Council Rates"}
                  categoryLabel="Council Rates"
                  result={result}
                  onRemove={onRemove}
                  override={item.input.override}
                  onOverrideChange={(override) => onPatch({ override })}
                >
                  <RatesForm input={item.input} onPatch={onPatch} />
                </AdjustmentCard>
              );
            }
            case "WATER": {
              const result = resultsById.get(item.id)!;
              const onPatch = (patch: Partial<WaterAdjustmentInput>) => dispatch({ type: "UPDATE_ADJUSTMENT", id: item.id, patch });
              const waterLabel =
                jurisdiction === "QLD"
                  ? "Queensland Water Adjustment"
                  : jurisdiction === "NSW"
                    ? "New South Wales Water Adjustment"
                    : "Water";
              const timeline =
                item.input.waterMode === "FLAT" &&
                isValidIsoDate(item.input.periodStart) &&
                isValidIsoDate(item.input.periodEnd) &&
                isValidIsoDate(settlementDate) &&
                item.input.amountCents !== null
                  ? prorateByPeriod({
                      amountCents: item.input.amountCents,
                      periodStart: item.input.periodStart as string,
                      periodEnd: item.input.periodEnd as string,
                      settlementDate: settlementDate as string,
                    })
                  : null;
              return (
                <AdjustmentCard
                  key={item.id}
                  title={item.input.label || waterLabel}
                  categoryLabel={waterLabel}
                  result={result}
                  onRemove={onRemove}
                  override={item.input.override}
                  onOverrideChange={(override) => onPatch({ override })}
                >
                  <WaterStatusLine result={result} />
                  <WaterForm input={item.input} onPatch={onPatch} />
                  {timeline && (
                    <WaterTimeline
                      periodStart={item.input.periodStart as string}
                      periodEnd={item.input.periodEnd as string}
                      settlementDate={settlementDate as string}
                      sellerDays={timeline.sellerDays}
                      buyerDays={timeline.buyerDays}
                    />
                  )}
                  {trainingMode && <WaterTrainingNotes />}
                </AdjustmentCard>
              );
            }
            case "BODY_CORPORATE": {
              const result = resultsById.get(item.id)!;
              const onPatch = (patch: Partial<BodyCorporateAdjustmentInput>) => dispatch({ type: "UPDATE_ADJUSTMENT", id: item.id, patch });
              const bodyCorporateLabel = jurisdictionCategoryLabel(jurisdiction, "BODY_CORPORATE");
              return (
                <AdjustmentCard
                  key={item.id}
                  title={item.input.label || bodyCorporateLabel}
                  categoryLabel={bodyCorporateLabel}
                  result={result}
                  onRemove={onRemove}
                  override={item.input.override}
                  onOverrideChange={(override) => onPatch({ override })}
                >
                  <BodyCorporateForm input={item.input} onPatch={onPatch} />
                </AdjustmentCard>
              );
            }
            case "RENT": {
              const result = resultsById.get(item.id)!;
              const onPatch = (patch: Partial<RentAdjustmentInput>) => dispatch({ type: "UPDATE_ADJUSTMENT", id: item.id, patch });
              return (
                <AdjustmentCard
                  key={item.id}
                  title={item.input.label || "Rent"}
                  categoryLabel="Rent"
                  result={result}
                  onRemove={onRemove}
                  override={item.input.override}
                  onOverrideChange={(override) => onPatch({ override })}
                >
                  <RentForm input={item.input} onPatch={onPatch} />
                </AdjustmentCard>
              );
            }
            case "LAND_TAX": {
              const result = resultsById.get(item.id)!;
              const onPatch = (patch: Partial<LandTaxAdjustmentInput>) => dispatch({ type: "UPDATE_ADJUSTMENT", id: item.id, patch });
              return (
                <AdjustmentCard
                  key={item.id}
                  title={item.input.label || "Land Tax"}
                  categoryLabel="Land Tax"
                  result={result}
                  onRemove={onRemove}
                  showOverride={false}
                >
                  <LandTaxForm input={item.input} onPatch={onPatch} />
                </AdjustmentCard>
              );
            }
            case "CUSTOM": {
              const result = resultsById.get(item.id)!;
              const onPatch = (patch: Partial<CustomAdjustmentInput>) => dispatch({ type: "UPDATE_ADJUSTMENT", id: item.id, patch });
              return (
                <AdjustmentCard
                  key={item.id}
                  title={item.input.description || "Custom Adjustment"}
                  categoryLabel="Custom Adjustment"
                  result={result}
                  onRemove={onRemove}
                  showOverride={false}
                >
                  <CustomForm input={item.input} onPatch={onPatch} />
                </AdjustmentCard>
              );
            }
          }
        })}
      </div>
    </div>
  );
}
