/**
 * Rent — for a tenanted property. Unlike the outgoing categories (rates,
 * water, body corporate), rent is money flowing IN, which flips which party
 * a "already happened" event favours: if the seller has already collected
 * rent covering a period that runs past settlement, the SELLER owes the
 * BUYER their share (not the other way around, the way an already-paid
 * outgoing notice works).
 *
 * The daily rate is derived from the entered frequency and the actual
 * period being adjusted — Monthly rent divides by the real number of days
 * in that specific calendar month, never a hardcoded 30, per the spec's
 * explicit "not a fixed 30-day month" requirement.
 */

import { compareIsoDates, daysInMonthOf, daysInclusive, formatLongAuDate, isValidIsoDate, type IsoDate } from "../dates";
import { formatAUD, isNonNegative, multiplyCentsByRatio, type Cents } from "../money";
import { prorateByPeriod } from "../proration";
import { mirroredEntries } from "../ledger";
import { finalizeAdjustmentResult } from "../override";
import { error, reconcileAgainstFigure, warning } from "../warnings";
import type {
  AdjustmentCalculationResult,
  AdjustmentMessage,
  CalculationTrailStep,
  ManualOverride,
} from "../types";

export type RentFrequency = "DAILY" | "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

export const RENT_FREQUENCY_LABEL: Record<RentFrequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
};

/** Whether the seller has already collected the rent for this period, or it's still owed. Rent's own vocabulary — "paid by" doesn't fit money the seller *received*. */
export type RentCollectionStatus = "COLLECTED_BY_SELLER" | "NOT_YET_COLLECTED";

export interface RentAdjustmentInput {
  id: string;
  label: string;
  rentAmountCents: Cents | null;
  frequency: RentFrequency | null;
  periodStart: IsoDate | null;
  periodEnd: IsoDate | null;
  rentPaidToDate: IsoDate | null;
  collectionStatus: RentCollectionStatus | null;
  referenceFigureCents: Cents | null;
  notes: string;
  override: ManualOverride;
}

export function newRentAdjustmentInput(id: string): RentAdjustmentInput {
  return {
    id,
    label: "",
    rentAmountCents: null,
    frequency: null,
    periodStart: null,
    periodEnd: null,
    rentPaidToDate: null,
    collectionStatus: null,
    referenceFigureCents: null,
    notes: "",
    override: { enabled: false, amountCents: null, reason: "" },
  };
}

function cycleDaysFor(frequency: RentFrequency, periodStart: IsoDate): number {
  switch (frequency) {
    case "DAILY":
      return 1;
    case "WEEKLY":
      return 7;
    case "FORTNIGHTLY":
      return 14;
    case "MONTHLY":
      return daysInMonthOf(periodStart);
  }
}

export function calculateRentAdjustment(
  input: RentAdjustmentInput,
  ctx: { settlementDate: IsoDate | null },
): AdjustmentCalculationResult {
  const label = input.label.trim() || "Rent";
  const overrideDebitParty = input.collectionStatus === "COLLECTED_BY_SELLER" ? "SELLER" : "BUYER";

  const messages: AdjustmentMessage[] = [];
  if (input.rentAmountCents === null || !isNonNegative(input.rentAmountCents) || input.rentAmountCents === 0) {
    messages.push(error("Enter the rent amount."));
  }
  if (!input.frequency) messages.push(error("Select the rent frequency."));
  if (!isValidIsoDate(input.periodStart) || !isValidIsoDate(input.periodEnd)) {
    messages.push(error("Enter the rent period being adjusted (start and end date)."));
  } else if (compareIsoDates(input.periodEnd, input.periodStart) < 0) {
    messages.push(error("Rent period end date is before the start date — check the tenancy records."));
  }
  if (!input.collectionStatus) {
    messages.push(error("Specify whether the seller has already collected this rent, to determine the adjustment direction."));
  }
  if (!isValidIsoDate(ctx.settlementDate)) messages.push(error("Enter the settlement date before this adjustment can be calculated."));

  const bail = () =>
    finalizeAdjustmentResult({
      id: input.id,
      category: "RENT",
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
  const frequency = input.frequency as RentFrequency;

  if (compareIsoDates(settlementDate, periodStart) < 0) {
    messages.push(warning("Settlement date falls before this rent period starts — this may be the wrong period."));
    return bail();
  }
  if (compareIsoDates(settlementDate, periodEnd) > 0) {
    messages.push(warning("Settlement date falls after this rent period ends — check whether a later period should be used instead."));
    return bail();
  }

  const cycleDays = cycleDaysFor(frequency, periodStart);
  // The rent amount is per one cycle (e.g. $500/week); the period being
  // adjusted may span a different number of days than one cycle, so derive
  // that period's total rent from a real daily rate first.
  const periodAmountCents = multiplyCentsByRatio(
    input.rentAmountCents as Cents,
    daysInclusive(periodStart, periodEnd),
    cycleDays,
  );

  const p = prorateByPeriod({ amountCents: periodAmountCents, periodStart, periodEnd, settlementDate });

  const trail: CalculationTrailStep[] = [
    { label: "Rent period", value: `${formatLongAuDate(periodStart)} – ${formatLongAuDate(periodEnd)}` },
    { label: "Frequency", value: RENT_FREQUENCY_LABEL[frequency] },
    { label: "Rent amount per cycle", value: formatAUD(input.rentAmountCents) },
    {
      label: "Days per cycle",
      value: frequency === "MONTHLY" ? `${cycleDays} (actual days in this calendar month)` : `${cycleDays}`,
    },
    { label: "Period days", value: `${p.periodTotalDays}` },
    { label: "Total rent for this period", value: formatAUD(periodAmountCents) },
    { label: "Seller days (to and including settlement)", value: `${p.sellerDays}` },
    { label: "Buyer days (from day after settlement)", value: `${p.buyerDays}` },
  ];

  const settlementAdjustmentCents = input.collectionStatus === "COLLECTED_BY_SELLER" ? p.buyerShareCents : p.sellerShareCents;
  trail.push(
    {
      label: "Settlement treatment",
      value:
        input.collectionStatus === "COLLECTED_BY_SELLER"
          ? "Seller debit / Buyer credit (seller already collected rent covering the buyer's period)"
          : "Buyer debit / Seller credit (rent not yet collected for the seller's period)",
    },
    { label: "Adjustment", value: formatAUD(settlementAdjustmentCents) },
  );

  const ledgerEntries = mirroredEntries({
    sourceAdjustmentId: input.id,
    category: "RENT",
    amountCents: settlementAdjustmentCents,
    description: `${label} — settlement adjustment`,
    debitParty: overrideDebitParty,
  });

  const reconcileMsg = reconcileAgainstFigure(settlementAdjustmentCents, input.referenceFigureCents, "reference");
  if (reconcileMsg) messages.push(reconcileMsg);

  return finalizeAdjustmentResult({
    id: input.id,
    category: "RENT",
    override: input.override,
    overrideDescription: `${label} — manual override`,
    overrideDebitParty,
    messages,
    automatic: { ledgerEntries, trail },
  });
}
