"use client";

import { useActionState } from "react";
import { BadgeCheck, Ban } from "lucide-react";
import {
  issueCertificateAction,
  revokeCertificateAction,
  type CertificateActionState,
} from "@/lib/actions/certificates";
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

function Feedback({ state }: { state: CertificateActionState }) {
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

export function IssueCertificateButton({
  certificateId,
  traineeName,
  programTitle,
}: {
  certificateId: string;
  traineeName: string;
  programTitle: string;
}) {
  const action = issueCertificateAction.bind(null, certificateId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <BadgeCheck className="size-3.5" />
        Sign off
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue this certificate?</DialogTitle>
          <DialogDescription>
            You are confirming that {traineeName} has genuinely completed {programTitle}, including
            anything the system cannot check on its own — simulator competency and any practical
            work you supervised. The certificate becomes publicly verifiable.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="contents">
          <Feedback state={state} />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Issuing…" : "Issue certificate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeCertificateButton({
  certificateId,
  certificateNumber,
}: {
  certificateId: string;
  certificateNumber: string;
}) {
  const action = revokeCertificateAction.bind(null, certificateId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <Ban className="size-3.5" />
        Revoke
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {certificateNumber}?</DialogTitle>
          <DialogDescription>
            The record is kept, but the certificate will verify as revoked from now on. This cannot
            be undone from here.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`reason-${certificateId}`}>Reason</Label>
            <Input
              id={`reason-${certificateId}`}
              name="reason"
              required
              placeholder="e.g. Issued against the wrong program"
            />
          </div>
          <Feedback state={state} />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Revoking…" : "Revoke"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
