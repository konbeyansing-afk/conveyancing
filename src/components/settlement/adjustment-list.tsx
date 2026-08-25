"use client";

import { Landmark, Droplet, Building2, KeyRound, ShieldAlert, FileEdit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettlement } from "@/lib/settlement/store";
import { computeAdjustmentResults } from "@/lib/settlement/compute";
import { ADJUSTMENT_CATEGORY_LABEL, type AdjustmentCategory } from "@/lib/settlement/types";
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

export function AdjustmentList() {
  const { state, dispatch } = useSettlement();
  const settlementDate = state.matter.settlementDate;
  const results = computeAdjustmentResults(state.adjustments, { settlementDate });
  const resultsById = new Map(results.map((r) => [r.id, r]));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 print:hidden">
        {ADD_BUTTONS.map(({ category, icon: Icon }) => (
          <Button key={category} variant="outline" size="sm" onClick={() => dispatch({ type: "ADD_ADJUSTMENT", category })}>
            <Plus className="size-3.5" />
            <Icon className="size-3.5" />
            {ADJUSTMENT_CATEGORY_LABEL[category]}
          </Button>
        ))}
      </div>

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
              return (
                <AdjustmentCard
                  key={item.id}
                  title={item.input.label || "Water"}
                  categoryLabel="Water"
                  result={result}
                  onRemove={onRemove}
                  override={item.input.override}
                  onOverrideChange={(override) => onPatch({ override })}
                >
                  <WaterForm input={item.input} onPatch={onPatch} />
                </AdjustmentCard>
              );
            }
            case "BODY_CORPORATE": {
              const result = resultsById.get(item.id)!;
              const onPatch = (patch: Partial<BodyCorporateAdjustmentInput>) => dispatch({ type: "UPDATE_ADJUSTMENT", id: item.id, patch });
              return (
                <AdjustmentCard
                  key={item.id}
                  title={item.input.label || "Body Corporate"}
                  categoryLabel="Body Corporate"
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
