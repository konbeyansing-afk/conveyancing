"use client";

import { useActionState, useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { resetUserPassword } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
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

/**
 * Generates a one-time password for another account and shows it to the admin
 * exactly once, so they can relay it. Nothing here ever displays or asks for
 * the account's existing password.
 */
export function ResetPasswordDialog({
  userId,
  userName,
  userEmail,
}: {
  userId: string;
  userName: string;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const action = resetUserPassword.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, null);

  const temporaryPassword = state?.temporaryPassword;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCopied(false);
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <KeyRound className="size-3.5" />
        Reset password
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {userName}?</DialogTitle>
          <DialogDescription>
            This replaces the password on {userEmail} with a new random one and requires them to
            choose their own the next time they sign in. Their existing password stops working
            immediately.
          </DialogDescription>
        </DialogHeader>

        {temporaryPassword ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium">Give them this password:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border bg-muted px-3 py-2 font-mono text-sm break-all">
                {temporaryPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(temporaryPassword);
                  setCopied(true);
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              It is not stored anywhere in readable form and cannot be shown again. If you lose it,
              just reset again.
            </p>
          </div>
        ) : (
          <form action={formAction} className="contents">
            {state?.error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Resetting…" : "Reset password"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {temporaryPassword && (
          <DialogFooter>
            <DialogClose render={<Button type="button" />}>Done</DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
