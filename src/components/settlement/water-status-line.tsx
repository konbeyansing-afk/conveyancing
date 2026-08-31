import { CheckCircle2, CircleAlert, CircleDashed, ShieldCheck } from "lucide-react";
import type { AdjustmentCalculationResult } from "@/lib/settlement/types";

/**
 * "CALCULATED / VERIFIED / REQUIRES REVIEW / ESTIMATE" (spec) — never
 * "100% accurate". Derived from the same tiered messages/override state the
 * rest of the engine already produces, just labelled in the vocabulary the
 * spec asks for rather than the generic ok/warning/error tier names.
 */
export function WaterStatusLine({ result }: { result: AdjustmentCalculationResult }) {
  if (result.pending) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleDashed className="size-3.5" />
        Incomplete — notice not yet received.
      </p>
    );
  }
  if (result.tier === "error") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-destructive">
        <CircleAlert className="size-3.5" />
        Incomplete — required information missing.
      </p>
    );
  }
  if (result.effective?.source === "override") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-success">
        <ShieldCheck className="size-3.5" />
        Verified — manually overridden with a recorded reason.
      </p>
    );
  }
  if (result.tier === "warning") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-warning">
        <CircleAlert className="size-3.5" />
        Requires review — see the flagged item(s) below.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-success">
      <CheckCircle2 className="size-3.5" />
      Calculated from the figures entered.
    </p>
  );
}
