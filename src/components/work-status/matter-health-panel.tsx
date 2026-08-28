import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { MatterHealthIssue } from "@/lib/checklist";

/**
 * "Matter Health" (spec section 13): a live self-check over one matter's
 * checklist — see validateChecklist. An empty list means the checklist
 * data is internally consistent (correct template, no duplicates, valid
 * dependencies, completion/blocked records present, no bypassed gates) —
 * it is not a claim that the conveyancing work itself is correct.
 */
export function MatterHealthPanel({ issues }: { issues: MatterHealthIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
        <CheckCircle2 className="size-3.5" />
        Matter Health: no issues found.
      </div>
    );
  }

  return (
    <div className="grid gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-destructive">
        <ShieldAlert className="size-3.5" />
        Matter Health: {issues.length} issue{issues.length === 1 ? "" : "s"} found
      </p>
      <ul className="grid gap-1 pl-5 text-destructive/90 [list-style:disc]">
        {issues.map((issue, i) => (
          <li key={`${issue.code}-${i}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}
