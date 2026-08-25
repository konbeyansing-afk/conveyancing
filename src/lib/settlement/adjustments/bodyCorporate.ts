/**
 * Body Corporate — administrative fund levy, sinking fund levy, special
 * levy, and other body corporate charges. Reuses the same period-proration
 * shape as Council Rates, but keeps levy type as a first-class field (not
 * just a label) since a special levy is worth flagging distinctly — it's
 * often a one-off, non-recurring charge a buyer needs to know was raised.
 */

import { compareIsoDates, formatLongAuDate, isValidIsoDate, type IsoDate } from "../dates";
import { formatAUD, isNonNegative, type Cents } from "../money";
import { prorateByPeriod } from "../proration";
import { resolveOutgoingLedgerEntries } from "../ledger";
import { finalizeAdjustmentResult } from "../override";
import { error, info, reconcileAgainstFigure, warning } from "../warnings";
import type {
  AdjustmentCalculationResult,
  AdjustmentMessage,
  CalculationTrailStep,
  ManualOverride,
  PaymentStatus,
} from "../types";

export type LevyType = "ADMIN_FUND" | "SINKING_FUND" | "SPECIAL_LEVY" | "OTHER_LEVY";

export const LEVY_TYPE_LABEL: Record<LevyType, string> = {
  ADMIN_FUND: "Administrative fund levy",
  SINKING_FUND: "Sinking fund levy",
  SPECIAL_LEVY: "Special levy",
  OTHER_LEVY: "Other body corporate charge",
};

export interface BodyCorporateAdjustmentInput {
  id: string;
  label: string;
  levyType: LevyType;
  levyAmountCents: Cents | null;
  periodStart: IsoDate | null;
  periodEnd: IsoDate | null;
  noticeConfirmedCurrent: boolean;
  noticeNotYetReceived: boolean;
  paymentStatus: PaymentStatus | null;
  referenceFigureCents: Cents | null;
  notes: string;
  override: ManualOverride;
}

export function newBodyCorporateAdjustmentInput(id: string, levyType: LevyType = "ADMIN_FUND"): BodyCorporateAdjustmentInput {
  return {
    id,
    label: "",
    levyType,
    levyAmountCents: null,
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

export function calculateBodyCorporateAdjustment(
  input: BodyCorporateAdjustmentInput,
  ctx: { settlementDate: IsoDate | null },
): AdjustmentCalculationResult {
  const label = input.label.trim() || LEVY_TYPE_LABEL[input.levyType];
  const overrideDebitParty = input.paymentStatus === "PAID_BY_SELLER" ? "BUYER" : "SELLER";

  if (input.noticeNotYetReceived) {
    return { id: input.id, pending: true, messages: [], tier: "ok", automatic: null, override: null, effective: null };
  }

  const messages: AdjustmentMessage[] = [];
  if (!input.noticeConfirmedCurrent) {
    messages.push(error("Confirm this levy notice is current before calculating."));
  }
  if (input.levyAmountCents === null || !isNonNegative(input.levyAmountCents) || input.levyAmountCents === 0) {
    messages.push(error("Enter the levy amount."));
  }
  if (!isValidIsoDate(input.periodStart) || !isValidIsoDate(input.periodEnd)) {
    messages.push(error("Enter the full levy period covered by this notice (start and end date)."));
  } else if (compareIsoDates(input.periodEnd, input.periodStart) < 0) {
    messages.push(error("Levy period end date is before the start date — check the notice."));
  }
  if (!input.paymentStatus) {
    messages.push(error("Specify whether this levy has already been paid, to determine the adjustment direction."));
  }
  if (!isValidIsoDate(ctx.settlementDate)) {
    messages.push(error("Enter the settlement date before this adjustment can be calculated."));
  }

  const bail = () =>
    finalizeAdjustmentResult({
      id: input.id,
      category: "BODY_CORPORATE",
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
    messages.push(warning("Settlement date falls before this levy period starts — this may be the wrong notice."));
    return bail();
  }
  if (compareIsoDates(settlementDate, periodEnd) > 0) {
    messages.push(warning("Settlement date falls after this levy period ends — the notice may be stale."));
    return bail();
  }

  const p = prorateByPeriod({
    amountCents: input.levyAmountCents as Cents,
    periodStart,
    periodEnd,
    settlementDate,
  });

  if (input.levyType === "SPECIAL_LEVY") {
    messages.push(info("A special levy is often a one-off charge — confirm with the body corporate manager whether it's intended to be adjusted at settlement, or is a cost the seller bears in full."));
  }

  const trail: CalculationTrailStep[] = [
    { label: "Levy type", value: LEVY_TYPE_LABEL[input.levyType] },
    { label: "Levy period", value: `${formatLongAuDate(periodStart)} – ${formatLongAuDate(periodEnd)}` },
    { label: "Levy amount", value: formatAUD(input.levyAmountCents) },
    { label: "Period days", value: `${p.periodTotalDays}` },
    { label: "Daily rate", value: formatAUD(p.dailyRateCents) },
    { label: "Seller days (to and including settlement)", value: `${p.sellerDays}` },
    { label: "Buyer days (from day after settlement)", value: `${p.buyerDays}` },
    { label: "Seller portion", value: formatAUD(p.sellerShareCents) },
    { label: "Buyer portion", value: formatAUD(p.buyerShareCents) },
  ];

  const ledgerEntries = resolveOutgoingLedgerEntries({
    sourceAdjustmentId: input.id,
    category: "BODY_CORPORATE",
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
          ? "Buyer debit / Seller credit (seller already paid the levy)"
          : "Seller debit / Buyer credit (levy not yet paid)",
    },
    { label: "Adjustment", value: formatAUD(settlementAdjustmentCents) },
  );

  const reconcileMsg = reconcileAgainstFigure(settlementAdjustmentCents, input.referenceFigureCents, "reference");
  if (reconcileMsg) messages.push(reconcileMsg);

  return finalizeAdjustmentResult({
    id: input.id,
    category: "BODY_CORPORATE",
    override: input.override,
    overrideDescription: `${label} — manual override`,
    overrideDebitParty,
    messages,
    automatic: { ledgerEntries, trail },
  });
}
