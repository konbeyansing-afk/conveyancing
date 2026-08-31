import { CheckCircle2, CircleAlert } from "lucide-react";
import { formatAUD } from "@/lib/settlement/money";
import type { WaterBillReconciliation } from "@/lib/settlement/adjustments/water";

/**
 * "Water bill does not reconcile" (spec section 18) — the sum of every
 * water component's calculated amount against whatever the source notice
 * states as its total, entered on any one component's "Total bill amount"
 * field. Rendered once per matter, not once per component.
 */
export function WaterReconciliationPanel({ reconciliation }: { reconciliation: WaterBillReconciliation | null }) {
  if (!reconciliation) return null;

  if (reconciliation.conflictingTotals) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
        <p>
          More than one water component has a different &quot;Total bill amount&quot; entered — clarify which
          figure is the actual notice total before relying on the reconciliation check.
        </p>
      </div>
    );
  }

  if (reconciliation.reconciles) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
        <CheckCircle2 className="size-3.5" />
        Water components reconcile to the bill total ({formatAUD(reconciliation.componentSumCents)}).
      </div>
    );
  }

  return (
    <div className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <p className="flex items-center gap-1.5 font-medium">
        <CircleAlert className="size-3.5" />
        Water bill does not reconcile
      </p>
      <p>
        Components sum to {formatAUD(reconciliation.componentSumCents)}, but the notice states{" "}
        {formatAUD(reconciliation.billTotalCents ?? 0)} — difference {formatAUD(reconciliation.differenceCents)}.
        Resolve this, or record an override with a reason, before finalising.
      </p>
    </div>
  );
}
