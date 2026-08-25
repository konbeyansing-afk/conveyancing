/**
 * Land Tax — deliberately has NO automatic day-proration formula. Whether
 * land tax is adjusted at settlement at all depends on the contract's
 * special conditions and the parties' circumstances, not a fixed rule this
 * calculator can safely assume. This module only ever produces a ledger
 * entry when the user explicitly confirms an adjustment applies AND
 * supplies the amount themselves — and always carries a mandatory warning
 * to confirm the treatment against the actual contract.
 */

import { finalizeAdjustmentResult } from "../override";
import { mirroredEntries } from "../ledger";
import { warning } from "../warnings";
import { formatAUD, type Cents } from "../money";
import type { AdjustmentCalculationResult, AdjustmentMessage, CalculationTrailStep, ManualOverride, Party } from "../types";

export interface LandTaxAdjustmentInput {
  id: string;
  label: string;
  landTaxAmountCents: Cents | null;
  financialYear: string;
  contractTreatmentNotes: string;
  adjustmentApplicable: boolean | null;
  /** Who bears the adjustment when applicable — the contract decides this, so it's asked directly rather than inferred. */
  debitParty: Party | null;
  manualAdjustmentCents: Cents | null;
  notes: string;
  override: ManualOverride;
}

export function newLandTaxAdjustmentInput(id: string): LandTaxAdjustmentInput {
  return {
    id,
    label: "",
    landTaxAmountCents: null,
    financialYear: "",
    contractTreatmentNotes: "",
    adjustmentApplicable: null,
    debitParty: null,
    manualAdjustmentCents: null,
    notes: "",
    override: { enabled: false, amountCents: null, reason: "" },
  };
}

const MANDATORY_WARNING = warning(
  "Land tax treatment must be confirmed against the contract's special conditions and the parties' actual circumstances before relying on this figure — it is never automatically calculated.",
);

export function calculateLandTaxAdjustment(input: LandTaxAdjustmentInput): AdjustmentCalculationResult {
  const label = input.label.trim() || "Land Tax";
  const messages: AdjustmentMessage[] = [MANDATORY_WARNING];

  if (!input.adjustmentApplicable) {
    // No adjustment applies (or hasn't been confirmed) — nothing to enter into the ledger.
    return {
      id: input.id,
      pending: false,
      messages,
      tier: "warning",
      automatic: null,
      override: null,
      effective: null,
    };
  }

  if (input.manualAdjustmentCents === null) {
    messages.push({ tier: "error", text: "Enter the manual land tax adjustment amount." });
  }
  if (!input.debitParty) {
    messages.push({ tier: "error", text: "Specify which party bears this adjustment, per the contract." });
  }

  const overrideDebitParty: Party = input.debitParty ?? "BUYER";

  if (messages.some((m) => m.tier === "error")) {
    return finalizeAdjustmentResult({
      id: input.id,
      category: "LAND_TAX",
      override: input.override,
      overrideDescription: `${label} — manual override`,
      overrideDebitParty,
      messages,
      automatic: null,
    });
  }

  const trail: CalculationTrailStep[] = [
    { label: "Financial year", value: input.financialYear || "—" },
    { label: "Contract treatment", value: input.contractTreatmentNotes || "—" },
    { label: "Manually entered adjustment", value: formatAUD(input.manualAdjustmentCents) },
    { label: "Bears the adjustment", value: input.debitParty === "SELLER" ? "Seller" : "Buyer" },
  ];

  const ledgerEntries = mirroredEntries({
    sourceAdjustmentId: input.id,
    category: "LAND_TAX",
    amountCents: input.manualAdjustmentCents as Cents,
    description: `${label} — manually confirmed adjustment`,
    debitParty: overrideDebitParty,
  });

  return finalizeAdjustmentResult({
    id: input.id,
    category: "LAND_TAX",
    override: input.override,
    overrideDescription: `${label} — manual override`,
    overrideDebitParty,
    messages,
    automatic: { ledgerEntries, trail },
  });
}
