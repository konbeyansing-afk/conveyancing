/**
 * Shared types for the settlement calculation engine: matter data, the
 * explicit debit/credit ledger, the tiered warning taxonomy, and the
 * per-adjustment / final-statement result shapes. No React here — these are
 * consumed by pure functions in adjustments/*.ts and statement.ts, and by
 * the React layer in store.tsx.
 */

import type { Cents } from "./money";
import type { IsoDate } from "./dates";

/* ------------------------------------------------------------------ */
/* Matter data                                                         */
/* ------------------------------------------------------------------ */

export type TransactionType = "PURCHASE" | "SALE";

export interface MatterDetails {
  transactionType: TransactionType;
  propertyAddress: string;
  contractDate: IsoDate | null;
  settlementDate: IsoDate | null;
  contractPriceCents: Cents | null;
  depositPaidCents: Cents | null;
  loanProceedsCents: Cents | null;
  clientFundsCents: Cents | null;
}

export interface BuyerCosts {
  transferDutyCents: Cents | null;
  registrationFeeCents: Cents | null;
  lodgementFeeCents: Cents | null;
  pexaFeeCents: Cents | null;
  searchFeesCents: Cents | null;
  professionalFeesCents: Cents | null;
  otherCostsCents: Cents | null;
  otherCostsNote: string;
}

export interface SellerCosts {
  mortgagePayoutCents: Cents | null;
  commissionCents: Cents | null;
  pexaFeeCents: Cents | null;
  professionalFeesCents: Cents | null;
  otherCostsCents: Cents | null;
  otherCostsNote: string;
}

export interface SettlementCosts {
  buyer: BuyerCosts;
  seller: SellerCosts;
}

/* ------------------------------------------------------------------ */
/* Ledger — the explicit debit/credit model                            */
/* ------------------------------------------------------------------ */

export type Party = "BUYER" | "SELLER";
export type Side = "DEBIT" | "CREDIT";

/**
 * One line of the double-entry ledger. Direction lives entirely in `side` —
 * never inferred from whether `amountCents` is positive or negative
 * (amountCents is always >= 0). An adjustment that affects both parties
 * (the overwhelmingly common case) emits two entries sharing the same
 * `sourceAdjustmentId`: e.g. a rates notice paid by the seller emits a
 * BUYER/DEBIT entry and a SELLER/CREDIT entry of the same amount — the
 * adjustment module itself is responsible for emitting both sides, not the
 * statement-assembly step, so the per-adjustment calculation trail and the
 * final statement are provably the same numbers.
 */
export interface LedgerEntry {
  party: Party;
  side: Side;
  amountCents: Cents;
  description: string;
  sourceAdjustmentId: string;
  category: AdjustmentCategory;
}

/* ------------------------------------------------------------------ */
/* Tiered messages                                                     */
/* ------------------------------------------------------------------ */

export type MessageTier = "info" | "warning" | "error";

export interface AdjustmentMessage {
  tier: MessageTier;
  text: string;
}

/* ------------------------------------------------------------------ */
/* Adjustments                                                         */
/* ------------------------------------------------------------------ */

export type AdjustmentCategory =
  | "RATES"
  | "WATER"
  | "BODY_CORPORATE"
  | "RENT"
  | "LAND_TAX"
  | "CUSTOM";

export const ADJUSTMENT_CATEGORY_LABEL: Record<AdjustmentCategory, string> = {
  RATES: "Council Rates",
  WATER: "Water",
  BODY_CORPORATE: "Body Corporate",
  RENT: "Rent",
  LAND_TAX: "Land Tax",
  CUSTOM: "Custom Adjustment",
};

/**
 * Who has paid the underlying notice/levy up to now, for an OUTGOING charge
 * (rates, water, body corporate) — decides the credit direction. Only the
 * seller can plausibly have already paid it, since they're the registered
 * proprietor before settlement; if unpaid, the buyer ends up paying the
 * full notice after settlement. (Rent — an INCOMING payment — has its own
 * `RentCollectionStatus` in adjustments/rent.ts, since "who paid" doesn't
 * apply the same way to money the seller *received*.)
 */
export type PaymentStatus = "PAID_BY_SELLER" | "NOT_YET_PAID";

/** One step of the dynamically-generated "View Calculation" breakdown. Rendered generically as a label/value list. */
export interface CalculationTrailStep {
  label: string;
  value: string;
}

export interface ManualOverride {
  enabled: boolean;
  amountCents: Cents | null;
  reason: string;
}

/**
 * The result of calculating one adjustment. Every category (rates, water,
 * body corporate, rent, land tax, custom) produces this same shape, so the
 * UI (adjustment-card.tsx, calculation-trail.tsx, override-control.tsx) can
 * render any of them generically.
 */
export interface AdjustmentCalculationResult {
  id: string;
  pending: boolean;
  messages: AdjustmentMessage[];
  /** Worst tier present in `messages` (or "ok" if none) — for list-level badges. */
  tier: "ok" | MessageTier;
  /** What the engine calculated automatically. Null when blocked by an error-tier message. */
  automatic: { ledgerEntries: LedgerEntry[]; trail: CalculationTrailStep[] } | null;
  /** The manual override, resolved to the same ledger shape, when enabled and valid. */
  override: { ledgerEntries: LedgerEntry[] } | null;
  /** What the statement actually uses: override if enabled+valid, else automatic. */
  effective: { ledgerEntries: LedgerEntry[]; source: "automatic" | "override" } | null;
}

/* ------------------------------------------------------------------ */
/* Settlement statement                                                */
/* ------------------------------------------------------------------ */

export interface StatementLine {
  description: string;
  side: Side;
  amountCents: Cents;
  sourceCategory: AdjustmentCategory | "COST" | "PRICE" | "DEPOSIT" | "LOAN" | "FUNDS";
}

export interface BalanceCheck {
  reconciles: boolean;
  detail: string;
}

export interface SettlementStatement {
  buyer: { lines: StatementLine[]; balanceRequiredCents: Cents };
  seller: { lines: StatementLine[]; netProceedsCents: Cents };
  balanceCheck: BalanceCheck;
  messages: AdjustmentMessage[];
}
