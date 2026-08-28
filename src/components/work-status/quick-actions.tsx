"use client";

import { useActionState, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, StickyNote } from "lucide-react";
import { addWorkNote, setWorkItemStatus, type WorkActionState } from "@/lib/actions/work-status";
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
import type { WorkStatus } from "@prisma/client";

/**
 * Dialogs here are deliberately uncontrolled (no `open` state) and never
 * close themselves on success — matching the rest of the app's action
 * dialogs (see certificate-actions.tsx, reset-password-dialog.tsx): a
 * success message is shown in place and the VA dismisses manually.
 */
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

/**
 * A one-click status change with no extra fields — Mark Completed, Mark
 * Pending. `icon` takes an already-rendered element (e.g. `<CheckCircle2 />`)
 * rather than a component reference: this renders inside a Server Component
 * (CurrentTaskCard), and passing a component/function as a prop across the
 * server/client boundary is not serializable — only elements are.
 */
export function QuickStatusButton({
  workItemId,
  newStatus,
  label,
  icon,
  variant = "outline",
}: {
  workItemId: string;
  newStatus: WorkStatus;
  label: string;
  icon?: ReactNode;
  variant?: "outline" | "default" | "secondary" | "ghost" | "destructive";
}) {
  const action = setWorkItemStatus.bind(null, workItemId, newStatus);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="grid gap-1">
      <form action={formAction}>
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {icon}
          {pending ? "Saving…" : label}
        </Button>
      </form>
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function MarkBlockedDialog({ workItemId }: { workItemId: string }) {
  const action = setWorkItemStatus.bind(null, workItemId, "BLOCKED");
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <AlertTriangle className="size-3.5" />
        Mark Blocked
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Blocked</DialogTitle>
          <DialogDescription>Let Admin know what&apos;s stopping you.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="blockedReason">Reason (required)</Label>
            <Textarea
              id="blockedReason"
              name="blockedReason"
              rows={2}
              required
              placeholder="Waiting for updated payout figure from lender."
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blockedNeeds">Needs</Label>
            <Input id="blockedNeeds" name="blockedNeeds" placeholder="Updated mortgage payout figure" />
          </div>
          <Feedback state={state} />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {state?.success ? "Done" : "Cancel"}
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Saving…" : "Mark Blocked"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddNoteDialog({ workItemId }: { workItemId: string }) {
  const action = addWorkNote.bind(null, workItemId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <StickyNote className="size-3.5" />
        Add Note
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a note</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <Textarea name="note" rows={3} required placeholder="What should Admin know?" />
          <Feedback state={state} />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {state?.success ? "Done" : "Cancel"}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Moves a matter back to IN_PROGRESS with an optional reason — covers both
 * "Resolve Blocker" and reopening a Completed matter (spec section 26).
 */
export function ResumeWorkDialog({
  workItemId,
  triggerLabel,
  dialogTitle,
  notePlaceholder,
}: {
  workItemId: string;
  triggerLabel: string;
  dialogTitle: string;
  notePlaceholder: string;
}) {
  const action = setWorkItemStatus.bind(null, workItemId, "IN_PROGRESS");
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <RotateCcw className="size-3.5" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="note">Reason</Label>
            <Textarea id="note" name="note" rows={2} placeholder={notePlaceholder} />
          </div>
          <Feedback state={state} />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {state?.success ? "Done" : "Cancel"}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : triggerLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
