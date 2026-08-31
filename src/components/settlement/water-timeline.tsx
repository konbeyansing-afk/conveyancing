import { formatLongAuDate, type IsoDate } from "@/lib/settlement/dates";

/**
 * The vendor/purchaser day-split for one water billing period (spec
 * "Visual Timeline" section) — a proportional bar, not the whole-bill
 * assumption this calculator deliberately avoids elsewhere: it only ever
 * reflects the actual period entered for this one component.
 */
export function WaterTimeline({
  periodStart,
  periodEnd,
  settlementDate,
  sellerDays,
  buyerDays,
}: {
  periodStart: IsoDate;
  periodEnd: IsoDate;
  settlementDate: IsoDate;
  sellerDays: number;
  buyerDays: number;
}) {
  const totalDays = sellerDays + buyerDays;
  const sellerPercent = totalDays === 0 ? 0 : (sellerDays / totalDays) * 100;

  return (
    <div className="grid gap-1.5 print:hidden">
      <div className="flex justify-between text-[0.65rem] text-muted-foreground">
        <span>{formatLongAuDate(periodStart)}</span>
        <span>{formatLongAuDate(periodEnd)}</span>
      </div>
      <div className="flex h-6 overflow-hidden rounded-md border text-[0.65rem] font-medium text-white">
        <div
          className="flex items-center justify-center bg-primary/70"
          style={{ width: `${sellerPercent}%` }}
          title={`Vendor: ${sellerDays} day${sellerDays === 1 ? "" : "s"}`}
        >
          {sellerPercent > 15 && <span>Vendor</span>}
        </div>
        <div
          className="flex items-center justify-center bg-primary"
          style={{ width: `${100 - sellerPercent}%` }}
          title={`Purchaser: ${buyerDays} day${buyerDays === 1 ? "" : "s"}`}
        >
          {100 - sellerPercent > 15 && <span>Purchaser</span>}
        </div>
      </div>
      <div className="flex justify-between text-[0.65rem] text-muted-foreground">
        <span>Vendor: {sellerDays} day{sellerDays === 1 ? "" : "s"}</span>
        <span>Settlement: {formatLongAuDate(settlementDate)}</span>
        <span>Purchaser: {buyerDays} day{buyerDays === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
