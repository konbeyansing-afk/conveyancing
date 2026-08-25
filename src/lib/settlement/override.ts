/**
 * Shared manual-override resolution, used by every auto-calculating
 * adjustment category (rates, water, body corporate, rent, land tax) so the
 * Automatic/Manual toggle behaves identically everywhere: an override
 * requires both an amount and a reason, the statement uses the override
 * amount while the automatic figure (if any) stays visible in the trail,
 * and the worst message tier present decides the card-level badge.
 */

import { mirroredEntries } from "./ledger";
import { error, warning, worstTier } from "./warnings";
import type {
  AdjustmentCalculationResult,
  AdjustmentCategory,
  AdjustmentMessage,
  CalculationTrailStep,
  LedgerEntry,
  ManualOverride,
  Party,
} from "./types";

export function finalizeAdjustmentResult(args: {
  id: string;
  category: AdjustmentCategory;
  override: ManualOverride;
  overrideDescription: string;
  /** Which party the override amount debits — normally the same direction the automatic calculation would use. */
  overrideDebitParty: Party;
  /** Messages already accumulated from category-specific validation (blocking errors, reconciliation warnings, etc). */
  messages: AdjustmentMessage[];
  automatic: { ledgerEntries: LedgerEntry[]; trail: CalculationTrailStep[] } | null;
}): AdjustmentCalculationResult {
  const messages = [...args.messages];
  let overrideResult: { ledgerEntries: LedgerEntry[] } | null = null;

  if (args.override.enabled) {
    if (args.override.amountCents === null) {
      messages.push(error("Enter the manual override amount."));
    } else if (!args.override.reason.trim()) {
      messages.push(error("A reason is required when overriding the calculated amount."));
    } else {
      overrideResult = {
        ledgerEntries: mirroredEntries({
          sourceAdjustmentId: args.id,
          category: args.category,
          amountCents: args.override.amountCents,
          description: args.overrideDescription,
          debitParty: args.overrideDebitParty,
        }),
      };
      messages.push(warning("Manual override entered — the settlement statement uses this amount, not the automatic calculation."));
    }
  }

  const effective =
    overrideResult !== null
      ? { ledgerEntries: overrideResult.ledgerEntries, source: "override" as const }
      : args.automatic
        ? { ledgerEntries: args.automatic.ledgerEntries, source: "automatic" as const }
        : null;

  return {
    id: args.id,
    pending: false,
    messages,
    tier: worstTier(messages),
    automatic: args.automatic,
    override: overrideResult,
    effective,
  };
}
