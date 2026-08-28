"use client";

import { useActionState, useState } from "react";
import { updateMatterStage } from "@/lib/actions/work-status";
import { JURISDICTION_LABELS, MATTER_STAGE_LABELS, matterWorkflow } from "@/lib/matter-stage";
import { Button } from "@/components/ui/button";
import type { Jurisdiction, MatterStage } from "@prisma/client";

/**
 * Moves a matter to a new stage in its conveyancing lifecycle. Options are
 * scoped to the matter's own jurisdiction workflow, so an NSW matter is
 * never offered a QLD-only stage — the server re-validates the same
 * constraint regardless of what this <select> offers.
 *
 * Shared between the VA's own "Currently Working On" card (a VA moves their
 * own matter along — they're the one actually doing the work) and the
 * Admin/Trainer work item detail sheet (oversight on any VA's matter).
 * `updateMatterStage` itself enforces who is allowed to touch which item.
 */
export function MatterStageEditor({
  item,
}: {
  item: { id: string; jurisdiction: Jurisdiction; matterStage: MatterStage };
}) {
  const action = updateMatterStage.bind(null, item.id);
  const [stage, setStage] = useState<MatterStage>(item.matterStage);
  const [state, formAction, pending] = useActionState(action, null);
  const stages = matterWorkflow(item.jurisdiction);

  return (
    <form action={formAction} className="grid gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <label htmlFor={`matterStage-${item.id}`} className="text-xs font-medium text-muted-foreground">
            Matter Stage ({JURISDICTION_LABELS[item.jurisdiction]} workflow)
          </label>
          <select
            id={`matterStage-${item.id}`}
            name="newStage"
            value={stage}
            onChange={(e) => setStage(e.target.value as MatterStage)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {MATTER_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending || stage === item.matterStage}>
          {pending ? "Saving…" : "Update Stage"}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-xs text-success">
          {state.success}
        </p>
      )}
    </form>
  );
}
