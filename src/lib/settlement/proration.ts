/**
 * Shared day-based proration, used by every category that splits a flat
 * amount across a period by settlement date: Council Rates, Body Corporate
 * levies, Water's flat mode, and Rent's per-period amount. Written once here
 * so none of those four category modules duplicates the formula.
 */

import { daysInclusive, type IsoDate } from "./dates";
import { multiplyCentsByRatio, subtractCents, type Cents } from "./money";

export interface ProrationInput {
  amountCents: Cents;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  settlementDate: IsoDate;
}

export interface ProrationResult {
  periodTotalDays: number;
  /** Display-only — never fed back into arithmetic, to avoid compounding rounding. */
  dailyRateCents: Cents;
  sellerDays: number;
  buyerDays: number;
  sellerShareCents: Cents;
  /** Always `amountCents - sellerShareCents`, so the two shares reconcile to the whole exactly. */
  buyerShareCents: Cents;
}

/**
 * Splits `amountCents` across `periodStart`..`periodEnd` (inclusive) by
 * `settlementDate`: the seller is responsible for the period up to and
 * including settlement day, the buyer from the day after. The buyer's share
 * is deliberately the remainder rather than its own ratio calculation, so
 * the two integer shares always sum exactly to `amountCents`.
 */
export function prorateByPeriod(input: ProrationInput): ProrationResult {
  const { amountCents, periodStart, periodEnd, settlementDate } = input;
  const periodTotalDays = daysInclusive(periodStart, periodEnd);
  const sellerDays = daysInclusive(periodStart, settlementDate);
  const buyerDays = periodTotalDays - sellerDays;
  const sellerShareCents = multiplyCentsByRatio(amountCents, sellerDays, periodTotalDays);
  const buyerShareCents = subtractCents(amountCents, sellerShareCents);
  const dailyRateCents = multiplyCentsByRatio(amountCents, 1, periodTotalDays);
  return { periodTotalDays, dailyRateCents, sellerDays, buyerDays, sellerShareCents, buyerShareCents };
}
