/**
 * Custom Adjustment — fully manual, no formula. Real QLD settlements
 * routinely have matter-specific adjustments that don't fit any of the
 * predefined categories (e.g. a special condition crediting the buyer for
 * an agreed repair, or a pool safety certificate cost split). There is
 * nothing to calculate here; the module exists to resolve a description,
 * amount, party and direction into the same ledger/result shape every
 * other category produces, so the UI and the statement can treat it
 * generically.
 */

import { formatAUD, isNonNegative, type Cents } from "../money";
import type { AdjustmentCalculationResult, AdjustmentMessage, CalculationTrailStep, LedgerEntry, Party, Side } from "../types";

export interface CustomAdjustmentInput {
  id: string;
  description: string;
  amountCents: Cents | null;
  party: Party | null;
  /** Whether the named party is debited or credited this amount. */
  side: Side;
  reason: string;
  contractReference: string;
  notes: string;
}

export function newCustomAdjustmentInput(id: string): CustomAdjustmentInput {
  return {
    id,
    description: "",
    amountCents: null,
    party: null,
    side: "DEBIT",
    reason: "",
    contractReference: "",
    notes: "",
  };
}

export function calculateCustomAdjustment(input: CustomAdjustmentInput): AdjustmentCalculationResult {
  const messages: AdjustmentMessage[] = [];
  if (!input.description.trim()) messages.push({ tier: "error", text: "Enter a description for this adjustment." });
  if (input.amountCents === null || !isNonNegative(input.amountCents) || input.amountCents === 0) {
    messages.push({ tier: "error", text: "Enter the adjustment amount." });
  }
  if (!input.party) messages.push({ tier: "error", text: "Specify which party this adjustment applies to." });
  if (!input.reason.trim()) messages.push({ tier: "error", text: "Enter a reason for this adjustment." });

  if (messages.some((m) => m.tier === "error")) {
    return { id: input.id, pending: false, messages, tier: "error", automatic: null, override: null, effective: null };
  }

  const party = input.party as Party;
  const side = input.side;
  const otherParty: Party = party === "BUYER" ? "SELLER" : "BUYER";
  const otherSide: Side = side === "DEBIT" ? "CREDIT" : "DEBIT";
  const amountCents = input.amountCents as Cents;

  const ledgerEntries: LedgerEntry[] = [
    { party, side, amountCents, description: input.description, sourceAdjustmentId: input.id, category: "CUSTOM" },
    { party: otherParty, side: otherSide, amountCents, description: input.description, sourceAdjustmentId: input.id, category: "CUSTOM" },
  ];

  const trail: CalculationTrailStep[] = [
    { label: "Description", value: input.description },
    { label: "Amount", value: formatAUD(input.amountCents) },
    { label: "Party", value: party === "BUYER" ? "Buyer" : "Seller" },
    { label: "Side", value: side === "DEBIT" ? "Debit" : "Credit" },
    { label: "Reason", value: input.reason },
    ...(input.contractReference.trim() ? [{ label: "Contract/reference", value: input.contractReference }] : []),
  ];

  return {
    id: input.id,
    pending: false,
    messages,
    tier: "ok",
    automatic: { ledgerEntries, trail },
    override: null,
    effective: { ledgerEntries, source: "automatic" },
  };
}
