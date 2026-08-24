"use client";

import { useActionState } from "react";
import { BadgeCheck, Undo2 } from "lucide-react";
import { approveStage, withdrawStageApproval } from "@/lib/actions/trainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function SignOffStageButton({
  traineeId,
  stageId,
  stageTitle,
  traineeName,
}: {
  traineeId: string;
  stageId: string;
  stageTitle: string;
  traineeName: string;
}) {
  const action = approveStage.bind(null, traineeId, stageId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <BadgeCheck className="size-3.5" />
        Sign off
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign off &ldquo;{stageTitle}&rdquo;?</DialogTitle>
          <DialogDescription>
            You are confirming that {traineeName} is competent at this stage, including the
            practical work you supervised. This unlocks the next stage for them.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`notes-${stageId}`}>Notes (optional)</Label>
            <Input id={`notes-${stageId}`} name="notes" placeholder="Anything worth recording" />
          </div>
          {state?.error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Signing off…" : "Sign off"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WithdrawSignOffButton({
  traineeId,
  stageId,
}: {
  traineeId: string;
  stageId: string;
}) {
  const action = withdrawStageApproval.bind(null, traineeId, stageId);
  const [, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        <Undo2 className="size-3.5" />
        {pending ? "Withdrawing…" : "Withdraw"}
      </Button>
    </form>
  );
}
