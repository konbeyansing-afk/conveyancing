/**
 * Assembles matter details, every adjustment's effective ledger entries, and
 * settlement costs into the two settlement statements (buyer, seller) plus
 * a balance check. This is the one place the buyer and seller formulas are
 * written — nowhere else in the engine or UI computes a balance figure.
 */

import { BUYER_COST_LABEL, SELLER_COST_LABEL } from "./costs";
import { addCents, formatAUD, subtractCents, type Cents } from "./money";
import { isValidIsoDate } from "./dates";
import { error } from "./warnings";
import type {
  AdjustmentCalculationResult,
  AdjustmentMessage,
  BalanceCheck,
  LedgerEntry,
  MatterDetails,
  SettlementCosts,
  SettlementStatement,
  StatementLine,
} from "./types";

function effectiveEntries(results: AdjustmentCalculationResult[]): LedgerEntry[] {
  return results.flatMap((r) => r.effective?.ledgerEntries ?? []);
}

function toLine(entry: LedgerEntry): StatementLine {
  return { description: entry.description, side: entry.side, amountCents: entry.amountCents, sourceCategory: entry.category };
}

function sumSide(lines: StatementLine[], side: "DEBIT" | "CREDIT"): Cents {
  return addCents(...lines.filter((l) => l.side === side).map((l) => l.amountCents));
}

export function buildSettlementStatement(
  matter: MatterDetails,
  adjustmentResults: AdjustmentCalculationResult[],
  costs: SettlementCosts,
): SettlementStatement {
  const topMessages: AdjustmentMessage[] = [];
  if (!isValidIsoDate(matter.settlementDate)) {
    topMessages.push(error("Enter the settlement date before a settlement statement can be produced."));
  }
  if (matter.contractPriceCents === null) {
    topMessages.push(error("Enter the contract price before a settlement statement can be produced."));
  }

  const entries = effectiveEntries(adjustmentResults);
  const buyerAdjustmentLines = entries.filter((e) => e.party === "BUYER").map(toLine);
  const sellerAdjustmentLines = entries.filter((e) => e.party === "SELLER").map(toLine);

  /* ---------------------------------------------------------------- */
  /* Buyer statement                                                    */
  /* balanceRequired = price + debits - credits - deposit - loan -      */
  /*                    clientFunds + buyer costs                       */
  /* ---------------------------------------------------------------- */

  const buyerLines: StatementLine[] = [];
  if (matter.contractPriceCents !== null) {
    buyerLines.push({ description: "Purchase price", side: "DEBIT", amountCents: matter.contractPriceCents, sourceCategory: "PRICE" });
  }
  buyerLines.push(...buyerAdjustmentLines);
  if (matter.depositPaidCents) {
    buyerLines.push({ description: "Deposit paid", side: "CREDIT", amountCents: matter.depositPaidCents, sourceCategory: "DEPOSIT" });
  }
  if (matter.loanProceedsCents) {
    buyerLines.push({ description: "Loan proceeds", side: "CREDIT", amountCents: matter.loanProceedsCents, sourceCategory: "LOAN" });
  }
  if (matter.clientFundsCents) {
    buyerLines.push({ description: "Other client funds", side: "CREDIT", amountCents: matter.clientFundsCents, sourceCategory: "FUNDS" });
  }
  for (const [key, amount] of Object.entries(costs.buyer)) {
    if (key === "otherCostsNote" || !amount) continue;
    const label = BUYER_COST_LABEL[key as keyof typeof BUYER_COST_LABEL];
    buyerLines.push({ description: label, side: "DEBIT", amountCents: amount as Cents, sourceCategory: "COST" });
  }

  const balanceRequiredCents = subtractCents(sumSide(buyerLines, "DEBIT"), sumSide(buyerLines, "CREDIT"));

  /* ---------------------------------------------------------------- */
  /* Seller statement                                                   */
  /* netProceeds = price + credits - debits - mortgage - commission -   */
  /*               other deductions                                     */
  /* ---------------------------------------------------------------- */

  const sellerLines: StatementLine[] = [];
  if (matter.contractPriceCents !== null) {
    sellerLines.push({ description: "Sale price", side: "CREDIT", amountCents: matter.contractPriceCents, sourceCategory: "PRICE" });
  }
  sellerLines.push(...sellerAdjustmentLines);
  for (const [key, amount] of Object.entries(costs.seller)) {
    if (key === "otherCostsNote" || !amount) continue;
    const label = SELLER_COST_LABEL[key as keyof typeof SELLER_COST_LABEL];
    sellerLines.push({ description: label, side: "DEBIT", amountCents: amount as Cents, sourceCategory: "COST" });
  }

  const netProceedsCents = subtractCents(sumSide(sellerLines, "CREDIT"), sumSide(sellerLines, "DEBIT"));

  /* ---------------------------------------------------------------- */
  /* Balance check — internal consistency, not an external reconcile.   */
  /* Every adjustment must have emitted exactly two mirrored entries:   */
  /* one BUYER, one SELLER, same amount, opposite economic effect.      */
  /* ---------------------------------------------------------------- */

  const balanceCheck = checkBalance(entries);

  return {
    buyer: { lines: buyerLines, balanceRequiredCents },
    seller: { lines: sellerLines, netProceedsCents },
    balanceCheck,
    messages: topMessages,
  };
}

function checkBalance(entries: LedgerEntry[]): BalanceCheck {
  const byAdjustment = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const list = byAdjustment.get(entry.sourceAdjustmentId) ?? [];
    list.push(entry);
    byAdjustment.set(entry.sourceAdjustmentId, list);
  }

  const problems: string[] = [];
  for (const [id, group] of byAdjustment) {
    if (group.length !== 2) {
      problems.push(`Adjustment ${id} produced ${group.length} ledger entries — expected exactly 2 (one buyer, one seller).`);
      continue;
    }
    const [a, b] = group;
    if (a.party === b.party) {
      problems.push(`Adjustment ${id} produced two entries for the same party (${a.party}) — expected one buyer and one seller entry.`);
      continue;
    }
    if (a.amountCents !== b.amountCents) {
      problems.push(`Adjustment ${id}'s buyer and seller entries don't agree on the amount (${formatAUD(a.amountCents)} vs ${formatAUD(b.amountCents)}).`);
      continue;
    }
    if (a.side === b.side) {
      problems.push(`Adjustment ${id} produced two entries on the same side (${a.side}) — expected one debit and one credit.`);
    }
  }

  return problems.length === 0
    ? { reconciles: true, detail: "" }
    : { reconciles: false, detail: problems.join(" ") };
}
