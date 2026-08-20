/**
 * QLD settlement adjustment math (rates / water / body corporate proration).
 * Pure functions, no I/O — the UI layer owns all state and never assumes a
 * figure the VA hasn't supplied. See src/app/app/tools/settlement-calculator
 * for the form that drives this.
 *
 * Water supports two modes, matching real retailer practice (see e.g.
 * Unitywater's own settlement calculator): "FLAT" prorates a flat notice
 * amount by day like rates/body corporate; "METERED" instead estimates real
 * unbilled usage from a previous read + special read (kL), because water
 * usage isn't fixed — the fixed *access* charge still prorates by day, but
 * usage has to be calculated from actual consumption, not assumed.
 */

export type AdjustmentCategory = "RATES" | "WATER" | "BODY_CORPORATE" | "OTHER";

export type PaymentStatus = "PAID_BY_SELLER" | "NOT_YET_PAID";

export type WaterCalcMode = "FLAT" | "METERED";

export interface AdjustmentItemInput {
  id: string;
  category: AdjustmentCategory;
  label: string;
  amount: number | null;
  periodStart: string | null; // ISO yyyy-mm-dd
  periodEnd: string | null; // ISO yyyy-mm-dd
  noticeConfirmedCurrent: boolean;
  noticeNotYetReceived: boolean;
  paymentStatus: PaymentStatus | null;
  pexaFigure: number | null;
  // Water-only metered-usage mode (category === "WATER" && waterMode === "METERED").
  waterMode?: WaterCalcMode;
  previousReadDate: string | null;
  previousReading: number | null; // kL
  specialReadDate: string | null;
  specialReading: number | null; // kL
  propertySharePercent: number | null; // 1–100
  usageRatePerKL: number | null;
  accessCharge: number | null; // fixed access charge for previousReadDate..settlementDate, lump sum
}

export interface AdjustmentItemResult {
  id: string;
  pending: boolean;
  blockingErrors: string[];
  warnings: string[];
  periodTotalDays: number | null;
  dailyRate: number | null;
  sellerDays: number | null;
  sellerShare: number | null;
  buyerDays: number | null;
  buyerShare: number | null;
  creditTo: "buyer" | "seller" | null;
  creditAmount: number | null;
  // Metered water only
  meteredTotalUsageKL: number | null;
  meteredAvgDailyUsageL: number | null;
  meteredUsageCharge: number | null;
  meteredAccessCharge: number | null;
}

export interface SettlementCalculationInput {
  settlementDate: string | null;
  items: AdjustmentItemInput[];
  contractPrice: number | null;
  depositPaid: number | null;
}

export interface SettlementCalculationOutput {
  settlementDateError: string | null;
  results: AdjustmentItemResult[];
  totalCreditToBuyer: number;
  totalCreditToSeller: number;
  netToBuyer: number; // positive = net credit reduces what buyer pays
  balancePurchasePrice: number | null;
  balanceUnavailableReason: string | null;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isValidISODate(iso: string | null): iso is string {
  if (!iso) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISODate(iso);
  return !Number.isNaN(d.getTime());
}

/** Inclusive day count from a to b (b - a + 1). Negative if b is before a. */
function daysBetweenInclusive(aISO: string, bISO: string): number {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/** Plain day difference between two dates (b - a), for meter-read spans rather than calendar periods. */
function daysBetweenExclusive(aISO: string, bISO: string): number {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const NULL_RESULT_FIELDS = {
  periodTotalDays: null,
  dailyRate: null,
  sellerDays: null,
  sellerShare: null,
  buyerDays: null,
  buyerShare: null,
  creditTo: null,
  creditAmount: null,
  meteredTotalUsageKL: null,
  meteredAvgDailyUsageL: null,
  meteredUsageCharge: null,
  meteredAccessCharge: null,
} as const;

/**
 * Checks a group of same-item notices (already filtered to one category+label)
 * for overlapping coverage or gaps between consecutive periods.
 */
function findOverlapsAndGaps(items: AdjustmentItemInput[]): Map<string, string[]> {
  const warningsById = new Map<string, string[]>();
  const withDates = items
    .filter((i) => isValidISODate(i.periodStart) && isValidISODate(i.periodEnd) && !i.noticeNotYetReceived)
    .filter((i) => i.periodEnd! >= i.periodStart!)
    .sort((a, b) => a.periodStart!.localeCompare(b.periodStart!));

  for (let i = 0; i < withDates.length - 1; i++) {
    const current = withDates[i];
    const next = withDates[i + 1];
    const pushWarning = (id: string, msg: string) => {
      const list = warningsById.get(id) ?? [];
      list.push(msg);
      warningsById.set(id, list);
    };
    if (next.periodStart! <= current.periodEnd!) {
      pushWarning(
        current.id,
        `Overlaps with another ${current.label || current.category} notice (${next.periodStart} – ${next.periodEnd}) — check you haven't double-counted.`
      );
      pushWarning(
        next.id,
        `Overlaps with another ${current.label || current.category} notice (${current.periodStart} – ${current.periodEnd}) — check you haven't double-counted.`
      );
    } else {
      const gapDays = daysBetweenInclusive(current.periodEnd!, next.periodStart!) - 1;
      if (gapDays > 0) {
        pushWarning(
          next.id,
          `There's a ${gapDays}-day gap between this notice and the previous ${current.label || current.category} notice — you may be missing a notice for that period.`
        );
      }
    }
  }
  return warningsById;
}

function groupKey(item: AdjustmentItemInput): string {
  return `${item.category}::${item.label.trim().toLowerCase()}`;
}

/**
 * Metered water: usage isn't fixed like rates, so instead of prorating a flat
 * notice amount, this estimates real unbilled usage. The read period
 * (previousReadDate → specialReadDate) gives an actual average daily usage;
 * that rate estimates the unbilled gap (specialReadDate → settlementDate).
 * Both segments are entirely pre-settlement (the seller's), so the whole
 * thing becomes a credit to the buyer — there's no seller/buyer day-split
 * the way there is for a flat notice.
 */
function calculateMeteredWaterResult(
  item: AdjustmentItemInput,
  settlementDate: string | null,
  existingWarnings: string[]
): AdjustmentItemResult {
  const warnings = [...existingWarnings];

  if (item.noticeNotYetReceived) {
    return { id: item.id, pending: true, blockingErrors: [], warnings: [], ...NULL_RESULT_FIELDS };
  }

  const blockingErrors: string[] = [];
  if (!item.noticeConfirmedCurrent) {
    blockingErrors.push("Confirm these readings match the search certificate/notice before calculating.");
  }
  if (!isValidISODate(item.previousReadDate)) blockingErrors.push("Enter the previous meter read date.");
  if (item.previousReading === null || item.previousReading < 0) {
    blockingErrors.push("Enter the previous meter reading (kL).");
  }
  if (!isValidISODate(item.specialReadDate)) blockingErrors.push("Enter the special meter read date.");
  if (item.specialReading === null || item.specialReading < 0) {
    blockingErrors.push("Enter the special meter reading (kL).");
  }
  if (item.propertySharePercent === null || item.propertySharePercent <= 0 || item.propertySharePercent > 100) {
    blockingErrors.push("Enter the property share (1–100%).");
  }
  if (item.usageRatePerKL === null || item.usageRatePerKL < 0) {
    blockingErrors.push("Enter the usage rate ($/kL) from the notice.");
  }
  if (item.accessCharge === null || item.accessCharge < 0) {
    blockingErrors.push("Enter the fixed access charge for this period.");
  }

  if (blockingErrors.length > 0) {
    return { id: item.id, pending: false, blockingErrors, warnings, ...NULL_RESULT_FIELDS };
  }

  if (item.specialReadDate! < item.previousReadDate!) {
    blockingErrors.push("Special read date is before the previous read date — check the dates.");
    return { id: item.id, pending: false, blockingErrors, warnings, ...NULL_RESULT_FIELDS };
  }
  const readPeriodDays = daysBetweenExclusive(item.previousReadDate!, item.specialReadDate!);
  if (readPeriodDays <= 0) {
    blockingErrors.push("The previous and special read dates must be different.");
    return { id: item.id, pending: false, blockingErrors, warnings, ...NULL_RESULT_FIELDS };
  }

  let rawUsageKL = item.specialReading! - item.previousReading!;
  if (rawUsageKL < 0) {
    warnings.push(
      "Special reading is lower than the previous reading — check for a meter reset or replacement. Treated as zero usage for this period."
    );
    rawUsageKL = 0;
  }
  const shareFraction = item.propertySharePercent! / 100;
  const actualUsageKL = rawUsageKL * shareFraction;
  const avgDailyUsageL = (actualUsageKL * 1000) / readPeriodDays;

  if (!isValidISODate(settlementDate)) {
    return {
      id: item.id,
      pending: false,
      blockingErrors: [],
      warnings,
      ...NULL_RESULT_FIELDS,
      meteredTotalUsageKL: Math.round(actualUsageKL * 1000) / 1000,
      meteredAvgDailyUsageL: Math.round(avgDailyUsageL),
    };
  }

  if (settlementDate! < item.specialReadDate!) {
    warnings.push("Settlement date is before the special meter read date — check you're using the right read.");
    return {
      id: item.id,
      pending: false,
      blockingErrors: [],
      warnings,
      ...NULL_RESULT_FIELDS,
      meteredTotalUsageKL: Math.round(actualUsageKL * 1000) / 1000,
      meteredAvgDailyUsageL: Math.round(avgDailyUsageL),
    };
  }

  const gapDays = daysBetweenExclusive(item.specialReadDate!, settlementDate!);
  const estimatedGapUsageKL = (avgDailyUsageL * gapDays) / 1000;
  const totalUsageKL = actualUsageKL + estimatedGapUsageKL;
  const usageCharge = roundCents(totalUsageKL * item.usageRatePerKL!);
  const accessCharge = roundCents(item.accessCharge!);
  const totalCharge = roundCents(usageCharge + accessCharge);

  if (item.pexaFigure !== null && Math.abs(item.pexaFigure - totalCharge) >= 0.01) {
    warnings.push(
      `Doesn't reconcile with the PEXA figure entered ($${item.pexaFigure.toFixed(2)} vs calculated $${totalCharge.toFixed(2)}) — flag for review rather than defer to either number.`
    );
  }

  return {
    id: item.id,
    pending: false,
    blockingErrors: [],
    warnings,
    ...NULL_RESULT_FIELDS,
    creditTo: "buyer",
    creditAmount: totalCharge,
    meteredTotalUsageKL: Math.round(totalUsageKL * 1000) / 1000,
    meteredAvgDailyUsageL: Math.round(avgDailyUsageL),
    meteredUsageCharge: usageCharge,
    meteredAccessCharge: accessCharge,
  };
}

export function calculateSettlement(input: SettlementCalculationInput): SettlementCalculationOutput {
  const settlementDateError = isValidISODate(input.settlementDate)
    ? null
    : "Enter the settlement date before calculating any adjustment.";

  // Group items by category+label to detect overlapping/gapped notices for the same thing
  // (e.g. two "Rates" notices, or body corporate admin fund vs sinking fund kept separate).
  // Metered water items have no periodStart/periodEnd so they're naturally excluded.
  const groups = new Map<string, AdjustmentItemInput[]>();
  for (const item of input.items) {
    const key = groupKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const overlapWarningsById = new Map<string, string[]>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const [id, warnings] of findOverlapsAndGaps(group)) {
      overlapWarningsById.set(id, warnings);
    }
  }

  const results: AdjustmentItemResult[] = input.items.map((item) => {
    const warnings: string[] = [...(overlapWarningsById.get(item.id) ?? [])];

    if (item.category === "WATER" && item.waterMode === "METERED") {
      return calculateMeteredWaterResult(item, input.settlementDate, warnings);
    }

    const blockingErrors: string[] = [];

    if (item.noticeNotYetReceived) {
      return { id: item.id, pending: true, blockingErrors: [], warnings: [], ...NULL_RESULT_FIELDS };
    }

    if (!item.noticeConfirmedCurrent) {
      blockingErrors.push("Confirm this notice is current (not superseded) before calculating.");
    }
    if (item.amount === null || item.amount <= 0) {
      blockingErrors.push("Enter the notice amount.");
    }
    if (!isValidISODate(item.periodStart) || !isValidISODate(item.periodEnd)) {
      blockingErrors.push("Enter the full period covered by this notice (start and end date).");
    } else if (item.periodEnd < item.periodStart) {
      blockingErrors.push("Period end date is before the start date — check the notice.");
    }
    if (!item.paymentStatus) {
      blockingErrors.push("Specify whether this has already been paid, to determine the credit direction.");
    }

    if (blockingErrors.length > 0) {
      return { id: item.id, pending: false, blockingErrors, warnings, ...NULL_RESULT_FIELDS };
    }

    const periodStart = item.periodStart!;
    const periodEnd = item.periodEnd!;
    const periodTotalDays = daysBetweenInclusive(periodStart, periodEnd);
    const dailyRate = item.amount! / periodTotalDays;

    if (!settlementDateError && input.settlementDate! < periodStart) {
      warnings.push("Settlement date falls before this notice's period starts — this may be the wrong notice.");
      return {
        id: item.id,
        pending: false,
        blockingErrors: [],
        warnings,
        ...NULL_RESULT_FIELDS,
        periodTotalDays,
        dailyRate: roundCents(dailyRate),
      };
    }
    if (!settlementDateError && input.settlementDate! > periodEnd) {
      warnings.push("Settlement date falls after this notice's period ends — the notice may be stale.");
      return {
        id: item.id,
        pending: false,
        blockingErrors: [],
        warnings,
        ...NULL_RESULT_FIELDS,
        periodTotalDays,
        dailyRate: roundCents(dailyRate),
      };
    }
    if (settlementDateError) {
      return {
        id: item.id,
        pending: false,
        blockingErrors: [],
        warnings,
        ...NULL_RESULT_FIELDS,
        periodTotalDays,
        dailyRate: roundCents(dailyRate),
      };
    }

    const sellerDays = daysBetweenInclusive(periodStart, input.settlementDate!);
    const buyerDays = periodTotalDays - sellerDays;
    const sellerShare = roundCents(dailyRate * sellerDays);
    // Buyer's share is the remainder so the two always reconcile exactly to the notice amount.
    const buyerShare = roundCents(item.amount!) - sellerShare;

    const creditTo = item.paymentStatus === "PAID_BY_SELLER" ? "seller" : "buyer";
    const creditAmount = item.paymentStatus === "PAID_BY_SELLER" ? buyerShare : sellerShare;

    if (item.pexaFigure !== null && Math.abs(item.pexaFigure - creditAmount) >= 0.01) {
      warnings.push(
        `Doesn't reconcile with the PEXA figure entered ($${item.pexaFigure.toFixed(2)} vs calculated $${creditAmount.toFixed(2)}) — flag for review rather than defer to either number.`
      );
    }

    return {
      id: item.id,
      pending: false,
      blockingErrors: [],
      warnings,
      ...NULL_RESULT_FIELDS,
      periodTotalDays,
      dailyRate: roundCents(dailyRate),
      sellerDays,
      sellerShare,
      buyerDays,
      buyerShare,
      creditTo,
      creditAmount,
    };
  });

  let totalCreditToBuyer = 0;
  let totalCreditToSeller = 0;
  for (const r of results) {
    if (r.creditTo === "buyer" && r.creditAmount !== null) totalCreditToBuyer += r.creditAmount;
    if (r.creditTo === "seller" && r.creditAmount !== null) totalCreditToSeller += r.creditAmount;
  }
  totalCreditToBuyer = roundCents(totalCreditToBuyer);
  totalCreditToSeller = roundCents(totalCreditToSeller);
  const netToBuyer = roundCents(totalCreditToBuyer - totalCreditToSeller);

  let balancePurchasePrice: number | null = null;
  let balanceUnavailableReason: string | null = null;
  if (input.contractPrice === null || input.depositPaid === null) {
    balanceUnavailableReason = "Enter the contract price and deposit paid to calculate the balance purchase price.";
  } else {
    balancePurchasePrice = roundCents(input.contractPrice - input.depositPaid - netToBuyer);
  }

  return {
    settlementDateError,
    results,
    totalCreditToBuyer,
    totalCreditToSeller,
    netToBuyer,
    balancePurchasePrice,
    balanceUnavailableReason,
  };
}
