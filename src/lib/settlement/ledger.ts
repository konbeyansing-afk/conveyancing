/**
 * Ledger-entry construction shared by every OUTGOING adjustment category
 * (rates, water, body corporate): resolves a period-proration result plus a
 * PaymentStatus into the mirrored buyer/seller ledger entries, so the
 * direction logic — "seller already paid means buyer owes seller their
 * share; not yet paid means seller owes buyer their share" — is written
 * once, not once per category.
 */

import type { Cents } from "./money";
import type { AdjustmentCategory, LedgerEntry, PaymentStatus } from "./types";

/**
 * Both sides of one adjustment's economic effect. Every category emits this
 * pair together — the statement never infers the mirror on its own.
 */
export function mirroredEntries(args: {
  sourceAdjustmentId: string;
  category: AdjustmentCategory;
  amountCents: Cents;
  description: string;
  debitParty: "BUYER" | "SELLER";
}): LedgerEntry[] {
  const creditParty = args.debitParty === "BUYER" ? "SELLER" : "BUYER";
  return [
    {
      party: args.debitParty,
      side: "DEBIT",
      amountCents: args.amountCents,
      description: args.description,
      sourceAdjustmentId: args.sourceAdjustmentId,
      category: args.category,
    },
    {
      party: creditParty,
      side: "CREDIT",
      amountCents: args.amountCents,
      description: args.description,
      sourceAdjustmentId: args.sourceAdjustmentId,
      category: args.category,
    },
  ];
}

/**
 * For an outgoing charge (rates/water/body corporate): if the seller has
 * already paid, they fronted money covering the buyer's post-settlement
 * period too, so the buyer owes the seller their share (BUYER debit).
 * If not yet paid, the buyer will pay the whole notice after settlement,
 * covering the seller's pre-settlement period too, so the seller owes the
 * buyer their share (SELLER debit).
 */
export function resolveOutgoingLedgerEntries(args: {
  sourceAdjustmentId: string;
  category: AdjustmentCategory;
  description: string;
  paymentStatus: PaymentStatus;
  sellerShareCents: Cents;
  buyerShareCents: Cents;
}): LedgerEntry[] {
  const isPaidBySeller = args.paymentStatus === "PAID_BY_SELLER";
  return mirroredEntries({
    sourceAdjustmentId: args.sourceAdjustmentId,
    category: args.category,
    description: args.description,
    amountCents: isPaidBySeller ? args.buyerShareCents : args.sellerShareCents,
    debitParty: isPaidBySeller ? "BUYER" : "SELLER",
  });
}
