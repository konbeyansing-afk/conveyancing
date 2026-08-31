"use client";

/**
 * "Calculation Status" (spec section 19) — 🟢 Ready / 🟡 Incomplete /
 * 🔴 Error, derived live from the same computeSettlementSnapshot the
 * server uses for its own snapshot, so the badge can never disagree with
 * what actually gets saved.
 */

import { AlertCircle, CheckCircle2, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { computeSettlementSnapshot } from "@/lib/settlement/snapshot";
import { useSettlement } from "@/lib/settlement/store";

export function CalculationStatusBadge() {
  const { state } = useSettlement();
  const snapshot = computeSettlementSnapshot(state);

  if (snapshot.status === "READY") {
    return (
      <Badge className="gap-1 bg-success/10 text-success">
        <CheckCircle2 className="size-3.5" />
        Ready — all required information has been entered
      </Badge>
    );
  }

  if (snapshot.status === "INCOMPLETE") {
    return (
      <Badge className="gap-1 bg-warning/10 text-warning">
        <CircleDot className="size-3.5" />
        Incomplete — {snapshot.missingRequiredCount} required field{snapshot.missingRequiredCount === 1 ? "" : "s"} missing
      </Badge>
    );
  }

  return (
    <Badge className="gap-1 bg-destructive/10 text-destructive">
      <AlertCircle className="size-3.5" />
      Error — please correct the highlighted fields
    </Badge>
  );
}
