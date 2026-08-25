/**
 * Council Rates — general rates, special rates, special charges, and other
 * council charges. All four are prorated identically by assessment period;
 * the charge type is a label distinction only (real practice doesn't split
 * their treatment), captured for the statement description and the
 * manual-override reason field's context.
 */

import { compareIsoDates, formatLongAuDate, isValidIsoDate, type IsoDate } from "../dates";
import { formatAUD, isNonNegative, type Cents } from "../money";
import { prorateByPeriod } from "../proration";
import { resolveOutgoingLedgerEntries } from "../ledger";
import { finalizeAdjustmentResult } from "../override";
import { error, reconcileAgainstFigure, warning } from "../warnings";
import type {
  AdjustmentCalculationResult,
  AdjustmentMessage,
  CalculationTrailStep,
  ManualOverride,
  PaymentStatus,
} from "../types";

export type RatesChargeType = "GENERAL_RATES" | "SPECIAL_RATES" | "SPECIAL_CHARGES" | "OTHER_COUNCIL_CHARGE";

export const RATES_CHARGE_TYPE_LABEL: Record<RatesChargeType, string> = {
  GENERAL_RATES: "General rates",
  SPECIAL_RATES: "Special rates",
  SPECIAL_CHARGES: "Special charges",
  OTHER_COUNCIL_CHARGE: "Other council charge",
};

export interface RatesAdjustmentInput {
  id: string;
  label: string;
  chargeType: RatesChargeType;
  assessmentAmountCents: Cents | null;
  periodStart: IsoDate | null;
  periodEnd: IsoDate | null;
  noticeConfirmedCurrent: boolean;
  noticeNotYetReceived: boolean;
  paymentStatus: PaymentStatus | null;
  referenceFigureCents: Cents | null;
  notes: string;
  override: ManualOverride;
}

export function newRatesAdjustmentInput(id: string, chargeType: RatesChargeType = "GENERAL_RATES"): RatesAdjustmentInput {
  return {
    id,
    label: "",
    chargeType,
    assessmentAmountCents: null,
    periodStart: null,
    periodEnd: null,
    noticeConfirmedCurrent: false,
    noticeNotYetReceived: false,
    paymentStatus: null,
    referenceFigureCents: null,
    notes: "",
    override: { enabled: false, amountCents: null, reason: "" },
  };
}

export function calculateRatesAdjustment(
  input: RatesAdjustmentInput,
  ctx: { settlementDate: IsoDate | null },
): AdjustmentCalculationResult {
  const label = input.label.trim() || RATES_CHARGE_TYPE_LABEL[input.chargeType];

  if (input.noticeNotYetReceived) {
    return { id: input.id, pending: true, messages: [], tier: "ok", automatic: null, override: null, effective: null };
  }

  const messages: AdjustmentMessage[] = [];
  if (!input.noticeConfirmedCurrent) {
    messages.push(error("Confirm this notice is current (not superseded) before calculating."));
  }
  if (input.assessmentAmountCents === null || !isNonNegative(input.assessmentAmountCents) || input.assessmentAmountCents === 0) {
    messages.push(error("Enter the assessment amount."));
  }
  if (!isValidIsoDate(input.periodStart) || !isValidIsoDate(input.periodEnd)) {
    messages.push(error("Enter the full assessment period covered by this notice (start and end date)."));
  } else if (compareIsoDates(input.periodEnd, input.periodStart) < 0) {
    messages.push(error("Assessment end date is before the start date — check the notice."));
  }
  if (!input.paymentStatus) {
    messages.push(error("Specify whether this has already been paid, to determine the adjustment direction."));
  }
  if (!isValidIsoDate(ctx.settlementDate)) {
    messages.push(error("Enter the settlement date before this adjustment can be calculated."));
  }

  const overrideDebitParty = input.paymentStatus === "PAID_BY_SELLER" ? "BUYER" : "SELLER";

  if (messages.some((m) => m.tier === "error")) {
    return finalizeAdjustmentResult({
      id: input.id,
      category: "RATES",
      override: input.override,
      overrideDescription: `${label} — manual override`,
      overrideDebitParty,
      messages,
      automatic: null,
    });
  }

  const periodStart = input.periodStart as IsoDate;
  const periodEnd = input.periodEnd as IsoDate;
  const settlementDate = ctx.settlementDate as IsoDate;

  if (compareIsoDates(settlementDate, periodStart) < 0) {
    messages.push(warning("Settlement date falls before this notice's assessment period starts — this may be the wrong notice."));
    return finalizeAdjustmentResult({
      id: input.id,
      category: "RATES",
      override: input.override,
      overrideDescription: `${label} — manual override`,
      overrideDebitParty,
      messages,
      automatic: null,
    });
  }
  if (compareIsoDates(settlementDate, periodEnd) > 0) {
    messages.push(warning("Settlement date falls after this notice's assessment period ends — the notice may be stale."));
    return finalizeAdjustmentResult({
      id: input.id,
      category: "RATES",
      override: input.override,
      overrideDescription: `${label} — manual override`,
      overrideDebitParty,
      messages,
      automatic: null,
    });
  }

  const p = prorateByPeriod({
    amountCents: input.assessmentAmountCents as Cents,
    periodStart,
    periodEnd,
    settlementDate,
  });

  const trail: CalculationTrailStep[] = [
    { label: "Assessment period", value: `${formatLongAuDate(periodStart)} – ${formatLongAuDate(periodEnd)}` },
    { label: "Assessment amount", value: formatAUD(input.assessmentAmountCents) },
    { label: "Assessment days", value: `${p.periodTotalDays}` },
    { label: "Daily rate", value: formatAUD(p.dailyRateCents) },
    { label: "Seller days (to and including settlement)", value: `${p.sellerDays}` },
    { label: "Buyer days (from day after settlement)", value: `${p.buyerDays}` },
    { label: "Seller portion", value: formatAUD(p.sellerShareCents) },
    { label: "Buyer portion", value: formatAUD(p.buyerShareCents) },
  ];

  const ledgerEntries = resolveOutgoingLedgerEntries({
    sourceAdjustmentId: input.id,
    category: "RATES",
    description: `${label} — settlement adjustment`,
    paymentStatus: input.paymentStatus as PaymentStatus,
    sellerShareCents: p.sellerShareCents,
    buyerShareCents: p.buyerShareCents,
  });
  const settlementAdjustmentCents = input.paymentStatus === "PAID_BY_SELLER" ? p.buyerShareCents : p.sellerShareCents;
  trail.push(
    {
      label: "Settlement treatment",
      value:
        input.paymentStatus === "PAID_BY_SELLER"
          ? "Buyer debit / Seller credit (seller already paid the notice)"
          : "Seller debit / Buyer credit (notice not yet paid)",
    },
    { label: "Adjustment", value: formatAUD(settlementAdjustmentCents) },
  );

  const reconcileMsg = reconcileAgainstFigure(settlementAdjustmentCents, input.referenceFigureCents, "reference");
  if (reconcileMsg) messages.push(reconcileMsg);

  return finalizeAdjustmentResult({
    id: input.id,
    category: "RATES",
    override: input.override,
    overrideDescription: `${label} — manual override`,
    overrideDebitParty,
    messages,
    automatic: { ledgerEntries, trail },
  });
}
