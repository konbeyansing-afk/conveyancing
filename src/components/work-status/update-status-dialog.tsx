"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { PlusCircle } from "lucide-react";
import {
  createWorkItem,
  resolveConflictAndSubmit,
  updateWorkItem,
  type WorkActionState,
} from "@/lib/actions/work-status";
import {
  WORK_PRIORITY_LABELS,
  WORK_PRIORITY_VALUES,
  WORK_STATUS_LABELS,
  WORK_STATUS_VALUES,
} from "@/lib/work-status";
import {
  JURISDICTION_LABELS,
  JURISDICTION_VALUES,
  MATTER_TYPE_LABELS,
  MATTER_TYPE_VALUES,
} from "@/lib/matter-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Jurisdiction, MatterType, WorkPriority, WorkStatus } from "@prisma/client";

export type EditableWorkItem = {
  id: string;
  title: string;
  matterReference: string | null;
  clientReference: string | null;
  jurisdiction: Jurisdiction;
  matterType: MatterType | null;
  status: WorkStatus;
  priority: WorkPriority;
  notes: string | null;
  blockedReason: string | null;
  blockedNeeds: string | null;
  estimatedCompletion: Date | null;
};

/** `datetime-local` inputs want "YYYY-MM-DDTHH:mm" in the viewer's local time. */
function toDateTimeLocal(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Feedback({ state }: { state: WorkActionState }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive">
        {state.error}
      </p>
    );
  }
  if (state?.success) {
    return (
      <p role="status" className="text-sm font-medium text-success">
        {state.success}
      </p>
    );
  }
  return null;
}

/** A no-op placeholder so the resolution hooks below can always be called (rules of hooks) even before there is a conflict to resolve. */
async function noConflictAction(): Promise<WorkActionState> {
  return null;
}

/**
 * The "+ Update Work Status" form — used both to start a new task and, when
 * `item` is supplied, to edit an existing one (the current task card's
 * "Update" quick action). Same fields either way. Uncontrolled/no
 * auto-close on success, matching the rest of the app's action dialogs — a
 * success message is shown in place and the VA dismisses manually.
 *
 * Every field is React-controlled rather than left as an uncontrolled
 * `defaultValue` input. That is deliberate: when the one-active-task
 * conflict banner (below) appears, it renders inside this same form, and in
 * practice that additional render pass was observed to detach the browser's
 * native input state for uncontrolled fields — the typed title/matter/etc
 * would be visibly wiped back to empty, taking the retry down with it. A
 * controlled field can't lose its value that way: React re-supplies it from
 * state on every render no matter what the DOM does underneath.
 */
export function UpdateWorkStatusDialog({
  item,
  trigger,
  triggerClassName,
}: {
  item?: EditableWorkItem;
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  const action = item ? updateWorkItem.bind(null, item.id) : createWorkItem;
  const [state, formAction, pending] = useActionState(action, null);

  const [title, setTitle] = useState(item?.title ?? "");
  const [matterReference, setMatterReference] = useState(item?.matterReference ?? "");
  const [clientReference, setClientReference] = useState(item?.clientReference ?? "");
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(item?.jurisdiction ?? "QLD");
  const [matterType, setMatterType] = useState<MatterType | "">(item?.matterType ?? "");
  const [status, setStatus] = useState<WorkStatus>(item?.status ?? "IN_PROGRESS");
  const [priority, setPriority] = useState<WorkPriority>(item?.priority ?? "NORMAL");
  const [blockedReason, setBlockedReason] = useState(item?.blockedReason ?? "");
  const [blockedNeeds, setBlockedNeeds] = useState(item?.blockedNeeds ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [estimatedCompletion, setEstimatedCompletion] = useState(
    toDateTimeLocal(item?.estimatedCompletion ?? null),
  );

  /**
   * React's `<form action={...}>` runs a native form reset after every
   * submission settles — including a failed/conflict one, since the form
   * *did* submit successfully as far as the browser is concerned, only the
   * server's response said "not yet". That reset touches the DOM directly,
   * and for a `<select>` (unlike `<input>`, which React tracks and
   * re-asserts) React does not always notice the value now disagrees with
   * `status`/`priority` state — it was observed reverting to the first
   * `<option>` right after the conflict banner appeared, silently
   * discarding what the VA had actually chosen. Re-stamping the select's
   * DOM value from state after every render is a plain synchronization, not
   * a state update, so it belongs in an effect.
   */
  const statusSelectRef = useRef<HTMLSelectElement>(null);
  const prioritySelectRef = useRef<HTMLSelectElement>(null);
  const jurisdictionSelectRef = useRef<HTMLSelectElement>(null);
  const matterTypeSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (statusSelectRef.current && statusSelectRef.current.value !== status) {
      statusSelectRef.current.value = status;
    }
    if (prioritySelectRef.current && prioritySelectRef.current.value !== priority) {
      prioritySelectRef.current.value = priority;
    }
    if (jurisdictionSelectRef.current && jurisdictionSelectRef.current.value !== jurisdiction) {
      jurisdictionSelectRef.current.value = jurisdiction;
    }
    if (matterTypeSelectRef.current && matterTypeSelectRef.current.value !== matterType) {
      matterTypeSelectRef.current.value = matterType;
    }
  });

  /**
   * The one-active-task conflict (spec section 16): "Would you like to mark
   * it as completed, pending, or pause it before starting this task?" Both
   * resolution buttons below live *inside* the same form as the fields
   * above and submit via their own `formAction`, so the title/matter/etc the
   * VA already typed travels along with the resolution in one round trip —
   * resolveConflictAndSubmit resolves the old task, then creates/updates
   * this one. Each is its own useActionState so pending/errors track
   * separately from the form's default submit; `effectiveState` picks
   * whichever one actually ran for rendering feedback and for the conflict
   * banner itself, so a successful resolution replaces the stale conflict.
   */
  const conflictId = state?.conflict?.id;
  const [completeResult, resolveCompleteAction, completePending] = useActionState(
    conflictId ? resolveConflictAndSubmit.bind(null, conflictId, "COMPLETED", item?.id ?? null) : noConflictAction,
    null,
  );
  const [pendingResult, resolvePendingAction, resolvePendingPending] = useActionState(
    conflictId
      ? resolveConflictAndSubmit.bind(null, conflictId, "WAITING_PENDING", item?.id ?? null)
      : noConflictAction,
    null,
  );
  const effectiveState = completeResult ?? pendingResult ?? state;

  return (
    <Dialog>
      <DialogTrigger render={<Button className={triggerClassName} />}>
        {trigger ?? (
          <>
            <PlusCircle className="size-4" />
            Update Work Status
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Update task" : "Update Work Status"}</DialogTitle>
          <DialogDescription>
            {item ? "Edit this task." : "Tell Admin what you're working on right now."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-3">
          {effectiveState?.conflict && (
            <div className="grid gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-sm">
                You currently have another task marked <strong>In Progress</strong> (&ldquo;
                {effectiveState.conflict.title}&rdquo;). Mark it completed or pending before starting this one.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  formAction={resolveCompleteAction}
                  size="sm"
                  variant="outline"
                  disabled={completePending || resolvePendingPending}
                >
                  {completePending ? "Saving…" : "Mark it Completed"}
                </Button>
                <Button
                  type="submit"
                  formAction={resolvePendingAction}
                  size="sm"
                  variant="outline"
                  disabled={completePending || resolvePendingPending}
                >
                  {resolvePendingPending ? "Saving…" : "Mark it Pending"}
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="title">What are you working on?</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reviewing contract and checking special conditions"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <select
                ref={jurisdictionSelectRef}
                id="jurisdiction"
                name="jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {JURISDICTION_VALUES.map((j) => (
                  <option key={j} value={j}>
                    {JURISDICTION_LABELS[j]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="matterType">Matter Type</Label>
              <select
                ref={matterTypeSelectRef}
                id="matterType"
                name="matterType"
                value={matterType}
                onChange={(e) => setMatterType(e.target.value as MatterType | "")}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="">Not specified</option>
                {MATTER_TYPE_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {MATTER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="matterReference">Matter / File Reference</Label>
              <Input
                id="matterReference"
                name="matterReference"
                value={matterReference}
                onChange={(e) => setMatterReference(e.target.value)}
                placeholder="SMITH-2026-001"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="clientReference">Client Reference</Label>
              <Input
                id="clientReference"
                name="clientReference"
                value={clientReference}
                onChange={(e) => setClientReference(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                ref={statusSelectRef}
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkStatus)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {WORK_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {WORK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="priority">Priority</Label>
              <select
                ref={prioritySelectRef}
                id="priority"
                name="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as WorkPriority)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {WORK_PRIORITY_VALUES.map((p) => (
                  <option key={p} value={p}>
                    {WORK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {status === "BLOCKED" && (
            <div className="grid gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="grid gap-1.5">
                <Label htmlFor="blockedReason">Reason (required)</Label>
                <Textarea
                  id="blockedReason"
                  name="blockedReason"
                  rows={2}
                  required
                  value={blockedReason}
                  onChange={(e) => setBlockedReason(e.target.value)}
                  placeholder="Waiting for updated payout figure from lender."
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="blockedNeeds">Needs</Label>
                <Input
                  id="blockedNeeds"
                  name="blockedNeeds"
                  value={blockedNeeds}
                  onChange={(e) => setBlockedNeeds(e.target.value)}
                  placeholder="Updated mortgage payout figure"
                />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="estimatedCompletion">Estimated Completion</Label>
            <Input
              id="estimatedCompletion"
              name="estimatedCompletion"
              type="datetime-local"
              value={estimatedCompletion}
              onChange={(e) => setEstimatedCompletion(e.target.value)}
            />
          </div>

          <Feedback state={effectiveState?.conflict ? null : effectiveState} />

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {effectiveState?.success ? "Done" : "Cancel"}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
