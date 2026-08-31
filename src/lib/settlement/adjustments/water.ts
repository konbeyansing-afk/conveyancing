/**
 * Water — access/service charge, usage, sewerage, and other water-related
 * charges, kept as separate component items (add one card per component)
 * rather than one lump "water bill" number, since they don't all behave the
 * same way: FLAT mode day-prorates a fixed notice amount exactly like
 * rates/body corporate (right for access/service charges and sewerage);
 * METERED mode instead estimates real unbilled usage from a previous read
 * and a special read (right for usage, which isn't a fixed amount) — the
 * calculator never invents a meter reading, and blocks with an error if the
 * information needed to estimate usage honestly isn't there.
 */

import { daysExclusive, compareIsoDates, formatLongAuDate, isValidIsoDate, type IsoDate } from "../dates";
import { addCents, formatAUD, isNonNegative, multiplyCentsByRatio, type Cents } from "../money";
import { prorateByPeriod } from "../proration";
import { mirroredEntries, resolveOutgoingLedgerEntries } from "../ledger";
import { finalizeAdjustmentResult } from "../override";
import { error, reconcileAgainstFigure, warning } from "../warnings";
import type {
  AdjustmentCalculationResult,
  AdjustmentMessage,
  CalculationTrailStep,
  ManualOverride,
  Party,
  PaymentStatus,
} from "../types";

export type WaterComponent = "ACCESS_CHARGE" | "USAGE" | "SEWERAGE" | "ARREARS" | "CREDIT" | "OTHER_WATER_CHARGE";
export type WaterCalcMode = "FLAT" | "METERED" | "ARREARS_CREDIT";

export const WATER_COMPONENT_LABEL: Record<WaterComponent, string> = {
  ACCESS_CHARGE: "Water access/service charge",
  USAGE: "Water usage",
  SEWERAGE: "Sewerage",
  ARREARS: "Arrears (pre-existing amount owed)",
  CREDIT: "Credit balance",
  OTHER_WATER_CHARGE: "Other water charge",
};

/** Where a figure on the water card came from — purely a record for audit, never affects the calculation. */
export type WaterSourceDocument = "WATER_BILL" | "RATES_NOTICE" | "SETTLEMENT_STATEMENT" | "OTHER";
export const WATER_SOURCE_DOCUMENT_LABEL: Record<WaterSourceDocument, string> = {
  WATER_BILL: "Water Bill",
  RATES_NOTICE: "Rates Notice",
  SETTLEMENT_STATEMENT: "Settlement Statement",
  OTHER: "Other",
};

export type WaterSourceStatus = "VERIFIED" | "NEEDS_VERIFICATION" | "MISSING";

export interface WaterAdjustmentInput {
  id: string;
  label: string;
  component: WaterComponent;
  waterMode: WaterCalcMode;
  // FLAT mode
  amountCents: Cents | null;
  periodStart: IsoDate | null;
  periodEnd: IsoDate | null;
  // Shared
  noticeConfirmedCurrent: boolean;
  noticeNotYetReceived: boolean;
  paymentStatus: PaymentStatus | null;
  referenceFigureCents: Cents | null;
  notes: string;
  override: ManualOverride;
  // METERED mode only
  previousReadDate: IsoDate | null;
  previousReadingKL: number | null;
  specialReadDate: IsoDate | null;
  specialReadingKL: number | null;
  propertySharePercent: number | null;
  usageRatePerKLCents: Cents | null;
  fixedAccessChargeCents: Cents | null;
  // ARREARS_CREDIT mode only — never prorated, never auto-directed (see calculateArrearsOrCredit)
  manualAmountCents: Cents | null;
  /** Arrears: who is responsible for paying it. Credit: who the credit is owed to. */
  relatedParty: Party | null;
  // Bill metadata — audit trail only, no effect on the calculated amount
  waterAuthority: string;
  noticeNumber: string;
  issueDate: IsoDate | null;
  dueDate: IsoDate | null;
  sourceDocument: WaterSourceDocument | null;
  sourceStatus: WaterSourceStatus;
  /** What the notice states as the grand total, for reconciling against the sum of every water component on this matter — see reconcileWaterBillTotal. */
  billTotalCents: Cents | null;
}

export function newWaterAdjustmentInput(id: string, component: WaterComponent = "ACCESS_CHARGE"): WaterAdjustmentInput {
  return {
    id,
    label: "",
    component,
    waterMode: component === "ARREARS" || component === "CREDIT" ? "ARREARS_CREDIT" : "FLAT",
    amountCents: null,
    periodStart: null,
    periodEnd: null,
    noticeConfirmedCurrent: false,
    noticeNotYetReceived: false,
    paymentStatus: null,
    referenceFigureCents: null,
    notes: "",
    override: { enabled: false, amountCents: null, reason: "" },
    previousReadDate: null,
    previousReadingKL: null,
    specialReadDate: null,
    specialReadingKL: null,
    propertySharePercent: null,
    usageRatePerKLCents: null,
    fixedAccessChargeCents: null,
    manualAmountCents: null,
    relatedParty: null,
    waterAuthority: "",
    noticeNumber: "",
    issueDate: null,
    dueDate: null,
    sourceDocument: null,
    sourceStatus: "NEEDS_VERIFICATION",
    billTotalCents: null,
  };
}

export function calculateWaterAdjustment(
  input: WaterAdjustmentInput,
  ctx: { settlementDate: IsoDate | null },
): AdjustmentCalculationResult {
  if (input.waterMode === "METERED") return calculateMeteredWater(input, ctx);
  if (input.waterMode === "ARREARS_CREDIT") return calculateArrearsOrCredit(input);
  return calculateFlatWater(input, ctx);
}

/* ------------------------------------------------------------------ */
/* ARREARS_CREDIT mode — a pre-existing amount, never prorated, never  */
/* auto-directed (same discipline as Land Tax: ask, never assume)       */
/* ------------------------------------------------------------------ */

function calculateArrearsOrCredit(input: WaterAdjustmentInput): AdjustmentCalculationResult {
  const label = input.label.trim() || WATER_COMPONENT_LABEL[input.component];
  const isCredit = input.component === "CREDIT";

  const messages: AdjustmentMessage[] = [
    warning(
      isCredit
        ? "A credit balance is a pre-existing amount on the account, not a period-based charge — confirm from the actual notice/statement who it's owed to before relying on this figure."
        : "Arrears are a pre-existing amount from before this billing period, not a period-based charge — confirm from the actual notice/statement who is responsible before relying on this figure.",
    ),
  ];

  if (input.manualAmountCents === null || !isNonNegative(input.manualAmountCents) || input.manualAmountCents === 0) {
    messages.push(error(`Enter the ${isCredit ? "credit" : "arrears"} amount.`));
  }
  if (!input.relatedParty) {
    messages.push(error(isCredit ? "Specify which party this credit is owed to." : "Specify which party is responsible for this arrears amount."));
  }

  // Arrears: the responsible party owes it (debited). Credit: the named
  // party is owed it (credited), so the other party is the ledger's debit side.
  const overrideDebitParty: Party = isCredit
    ? input.relatedParty === "SELLER"
      ? "BUYER"
      : "SELLER"
    : (input.relatedParty ?? "SELLER");

  if (messages.some((m) => m.tier === "error")) {
    return finalizeAdjustmentResult({
      id: input.id,
      category: "WATER",
      override: input.override,
      overrideDescription: `${label} — manual override`,
      overrideDebitParty,
      messages,
      automatic: null,
    });
  }

  const trail: CalculationTrailStep[] = [
    { label: isCredit ? "Credit amount" : "Arrears amount", value: formatAUD(input.manualAmountCents as Cents) },
    { label: "Treatment", value: "Not prorated — a pre-existing balance, not a period-based charge." },
    { label: isCredit ? "Owed to" : "Payable by", value: input.relatedParty === "SELLER" ? "Seller" : "Buyer" },
  ];

  const ledgerEntries = mirroredEntries({
    sourceAdjustmentId: input.id,
    category: "WATER",
    amountCents: input.manualAmountCents as Cents,
    description: `${label} — settlement adjustment`,
    debitParty: overrideDebitParty,
  });

  const reconcileMsg = reconcileAgainstFigure(input.manualAmountCents as Cents, input.referenceFigureCents, "reference");
  if (reconcileMsg) messages.push(reconcileMsg);

  return finalizeAdjustmentResult({
    id: input.id,
    category: "WATER",
    override: input.override,
    overrideDescription: `${label} — manual override`,
    overrideDebitParty,
    messages,
    automatic: { ledgerEntries, trail },
  });
}

/* ------------------------------------------------------------------ */
/* Bill-total reconciliation — across every water component on one     */
/* matter, against whatever the notice itself states as the total       */
/* ------------------------------------------------------------------ */

export interface WaterBillReconciliation {
  /** Sum of every water component's calculated (effective) amount. */
  componentSumCents: Cents;
  /** The notice's own stated total, if any item recorded one. Multiple different values across items is itself flagged. */
  billTotalCents: Cents | null;
  differenceCents: Cents;
  reconciles: boolean;
  conflictingTotals: boolean;
}

/**
 * Compares the sum of every water adjustment's calculated amount against
 * whatever the source notice states as its grand total (spec section 18) —
 * entered on any one water item's `billTotalCents`. Returns null when no
 * item has recorded a bill total, since there's nothing to reconcile
 * against yet (not an error — most matters won't have this filled in).
 */
export function reconcileWaterBillTotal(
  items: WaterAdjustmentInput[],
  results: Map<string, AdjustmentCalculationResult>,
): WaterBillReconciliation | null {
  const totals = new Set(items.map((i) => i.billTotalCents).filter((c): c is Cents => c !== null));
  if (totals.size === 0) return null;

  const componentSumCents = addCents(
    ...items.map((i) => {
      const effective = results.get(i.id)?.effective;
      if (!effective) return 0;
      // Every component contributes its debit-side amount once (the mirrored
      // credit is the same figure on the other party, so summing both would
      // double count) — the buyer-side entry's amount is that figure regardless
      // of which party it debits, since mirroredEntries always uses one amount.
      return effective.ledgerEntries[0]?.amountCents ?? 0;
    }),
  );

  const conflictingTotals = totals.size > 1;
  const billTotalCents = ([...totals][0] as Cents) ?? null;
  const differenceCents = Math.abs(componentSumCents - (billTotalCents ?? componentSumCents));

  return {
    componentSumCents,
    billTotalCents: conflictingTotals ? null : billTotalCents,
    differenceCents,
    reconciles: !conflictingTotals && differenceCents === 0,
    conflictingTotals,
  };
}

/* ------------------------------------------------------------------ */
/* FLAT mode — identical shape to rates/body corporate                 */
/* ------------------------------------------------------------------ */

function calculateFlatWater(
  input: WaterAdjustmentInput,
  ctx: { settlementDate: IsoDate | null },
): AdjustmentCalculationResult {
  const label = input.label.trim() || WATER_COMPONENT_LABEL[input.component];
  const overrideDebitParty = input.paymentStatus === "PAID_BY_SELLER" ? "BUYER" : "SELLER";

  if (input.noticeNotYetReceived) {
    return { id: input.id, pending: true, messages: [], tier: "ok", automatic: null, override: null, effective: null };
  }

  const messages: AdjustmentMessage[] = [];
  if (!input.noticeConfirmedCurrent) messages.push(error("Confirm this notice is current before calculating."));
  if (input.amountCents === null || !isNonNegative(input.amountCents) || input.amountCents === 0) {
    messages.push(error("Enter the notice amount."));
  }
  if (!isValidIsoDate(input.periodStart) || !isValidIsoDate(input.periodEnd)) {
    messages.push(error("Enter the full period covered by this notice (start and end date)."));
  } else if (compareIsoDates(input.periodEnd, input.periodStart) < 0) {
    messages.push(error("Period end date is before the start date — check the notice."));
  }
  if (!input.paymentStatus) messages.push(error("Specify whether this has already been paid, to determine the adjustment direction."));
  if (!isValidIsoDate(ctx.settlementDate)) messages.push(error("Enter the settlement date before this adjustment can be calculated."));

  const bail = () =>
    finalizeAdjustmentResult({
      id: input.id,
      category: "WATER",
      override: input.override,
      overrideDescription: `${label} — manual override`,
      overrideDebitParty,
      messages,
      automatic: null,
    });

  if (messages.some((m) => m.tier === "error")) return bail();

  const periodStart = input.periodStart as IsoDate;
  const periodEnd = input.periodEnd as IsoDate;
  const settlementDate = ctx.settlementDate as IsoDate;

  if (compareIsoDates(settlementDate, periodStart) < 0) {
    messages.push(warning("Settlement date falls before this notice's period starts — this may be the wrong notice."));
    return bail();
  }
  if (compareIsoDates(settlementDate, periodEnd) > 0) {
    messages.push(warning("Settlement date falls after this notice's period ends — the notice may be stale."));
    return bail();
  }

  const p = prorateByPeriod({ amountCents: input.amountCents as Cents, periodStart, periodEnd, settlementDate });

  const trail: CalculationTrailStep[] = [
    { label: "Component", value: WATER_COMPONENT_LABEL[input.component] },
    { label: "Period", value: `${formatLongAuDate(periodStart)} – ${formatLongAuDate(periodEnd)}` },
    { label: "Amount", value: formatAUD(input.amountCents) },
    { label: "Period days", value: `${p.periodTotalDays}` },
    { label: "Daily rate", value: formatAUD(p.dailyRateCents) },
    { label: "Seller days", value: `${p.sellerDays}` },
    { label: "Buyer days", value: `${p.buyerDays}` },
  ];

  const ledgerEntries = resolveOutgoingLedgerEntries({
    sourceAdjustmentId: input.id,
    category: "WATER",
    description: `${label} — settlement adjustment`,
    paymentStatus: input.paymentStatus as PaymentStatus,
    sellerShareCents: p.sellerShareCents,
    buyerShareCents: p.buyerShareCents,
  });
  const settlementAdjustmentCents = input.paymentStatus === "PAID_BY_SELLER" ? p.buyerShareCents : p.sellerShareCents;
  trail.push(
    {
      label: "Settlement treatment",
      value: input.paymentStatus === "PAID_BY_SELLER" ? "Buyer debit / Seller credit" : "Seller debit / Buyer credit",
    },
    { label: "Adjustment", value: formatAUD(settlementAdjustmentCents) },
  );

  const reconcileMsg = reconcileAgainstFigure(settlementAdjustmentCents, input.referenceFigureCents, "reference");
  if (reconcileMsg) messages.push(reconcileMsg);

  return finalizeAdjustmentResult({
    id: input.id,
    category: "WATER",
    override: input.override,
    overrideDescription: `${label} — manual override`,
    overrideDebitParty,
    messages,
    automatic: { ledgerEntries, trail },
  });
}

/* ------------------------------------------------------------------ */
/* METERED mode — estimates real unbilled usage, never invents a reading */
/* ------------------------------------------------------------------ */

function calculateMeteredWater(
  input: WaterAdjustmentInput,
  ctx: { settlementDate: IsoDate | null },
): AdjustmentCalculationResult {
  const label = input.label.trim() || WATER_COMPONENT_LABEL[input.component];
  // Metered usage is always a credit to the buyer (see below) — the whole
  // period being estimated is pre-settlement, i.e. the seller's.
  const overrideDebitParty = "SELLER";

  if (input.noticeNotYetReceived) {
    return { id: input.id, pending: true, messages: [], tier: "ok", automatic: null, override: null, effective: null };
  }

  const messages: AdjustmentMessage[] = [];
  if (!input.noticeConfirmedCurrent) {
    messages.push(error("Confirm these readings match the search certificate/notice before calculating."));
  }
  if (!isValidIsoDate(input.previousReadDate)) messages.push(error("Enter the previous meter read date."));
  if (input.previousReadingKL === null || input.previousReadingKL < 0) messages.push(error("Enter the previous meter reading (kL)."));
  if (!isValidIsoDate(input.specialReadDate)) messages.push(error("Enter the special meter read date."));
  if (input.specialReadingKL === null || input.specialReadingKL < 0) messages.push(error("Enter the special meter reading (kL)."));
  if (input.propertySharePercent === null || input.propertySharePercent <= 0 || input.propertySharePercent > 100) {
    messages.push(error("Enter the property's share of the meter (1–100%)."));
  }
  if (input.usageRatePerKLCents === null || input.usageRatePerKLCents < 0) {
    messages.push(error("Enter the usage rate ($/kL) from the notice — this calculator never assumes a water authority's current rate."));
  }
  if (input.fixedAccessChargeCents === null || input.fixedAccessChargeCents < 0) {
    messages.push(error("Enter the fixed access charge for this period."));
  }
  if (!isValidIsoDate(ctx.settlementDate)) messages.push(error("Enter the settlement date before this adjustment can be calculated."));

  const bail = () =>
    finalizeAdjustmentResult({
      id: input.id,
      category: "WATER",
      override: input.override,
      overrideDescription: `${label} — manual override`,
      overrideDebitParty,
      messages,
      automatic: null,
    });

  if (messages.some((m) => m.tier === "error")) return bail();

  const previousReadDate = input.previousReadDate as IsoDate;
  const specialReadDate = input.specialReadDate as IsoDate;
  const settlementDate = ctx.settlementDate as IsoDate;

  if (compareIsoDates(specialReadDate, previousReadDate) < 0) {
    messages.push(error("Special read date is before the previous read date — check the dates."));
    return bail();
  }
  const readPeriodDays = daysExclusive(previousReadDate, specialReadDate);
  if (readPeriodDays <= 0) {
    messages.push(error("The previous and special read dates must be different."));
    return bail();
  }

  let rawUsageKL = (input.specialReadingKL as number) - (input.previousReadingKL as number);
  if (rawUsageKL < 0) {
    messages.push(warning("Special reading is lower than the previous reading — check for a meter reset or replacement. Treated as zero usage for this period."));
    rawUsageKL = 0;
  }
  const shareFraction = (input.propertySharePercent as number) / 100;
  const actualUsageKL = rawUsageKL * shareFraction;
  const avgDailyUsageL = (actualUsageKL * 1000) / readPeriodDays;

  if (compareIsoDates(settlementDate, specialReadDate) < 0) {
    messages.push(warning("Settlement date is before the special meter read date — check you're using the right read."));
    return bail();
  }

  const gapDays = daysExclusive(specialReadDate, settlementDate);
  const estimatedGapUsageKL = (avgDailyUsageL * gapDays) / 1000;
  const totalUsageKL = actualUsageKL + estimatedGapUsageKL;
  const usageChargeCents = multiplyCentsByRatio(input.usageRatePerKLCents as Cents, Math.round(totalUsageKL * 1000), 1000);
  const accessChargeCents = input.fixedAccessChargeCents as Cents;
  const totalChargeCents = addCents(usageChargeCents, accessChargeCents);

  const trail: CalculationTrailStep[] = [
    { label: "Previous read", value: `${formatLongAuDate(previousReadDate)} — ${input.previousReadingKL} kL` },
    { label: "Special read", value: `${formatLongAuDate(specialReadDate)} — ${input.specialReadingKL} kL` },
    { label: "Property share", value: `${input.propertySharePercent}%` },
    { label: "Actual usage since previous read", value: `${(Math.round(actualUsageKL * 1000) / 1000).toLocaleString("en-AU")} kL` },
    { label: "Average daily usage", value: `${Math.round(avgDailyUsageL)} L/day` },
    { label: "Estimated usage from special read to settlement", value: `${(Math.round(estimatedGapUsageKL * 1000) / 1000).toLocaleString("en-AU")} kL (${gapDays} days)` },
    { label: "Total estimated usage", value: `${(Math.round(totalUsageKL * 1000) / 1000).toLocaleString("en-AU")} kL` },
    { label: "Usage charge", value: formatAUD(usageChargeCents) },
    { label: "Fixed access charge", value: formatAUD(accessChargeCents) },
    { label: "Settlement treatment", value: "Buyer credit — the whole estimated period is pre-settlement, so it is entirely the seller's usage." },
    { label: "Adjustment", value: formatAUD(totalChargeCents) },
  ];

  const ledgerEntries = mirroredEntries({
    sourceAdjustmentId: input.id,
    category: "WATER",
    amountCents: totalChargeCents,
    description: `${label} (metered) — settlement adjustment`,
    debitParty: "SELLER",
  });

  const reconcileMsg = reconcileAgainstFigure(totalChargeCents, input.referenceFigureCents, "reference");
  if (reconcileMsg) messages.push(reconcileMsg);

  return finalizeAdjustmentResult({
    id: input.id,
    category: "WATER",
    override: input.override,
    overrideDescription: `${label} — manual override`,
    overrideDebitParty,
    messages,
    automatic: { ledgerEntries, trail },
  });
}
