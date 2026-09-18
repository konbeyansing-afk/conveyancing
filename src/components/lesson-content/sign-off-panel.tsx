"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SignOffState = {
  traineeName: string | null;
  traineeSignedAt: string | null;
  trainerName: string | null;
  trainerResult: "PASS" | "REFER" | null;
  trainerSignedAt: string | null;
} | null;

type ActionState = { error?: string; success?: string } | null;

/**
 * The trainee-facing half of a lesson's sign-off (Lesson.requiresSignOff):
 * a name field the trainee fills in themselves, plus a confirmation
 * checkbox — never the Trainer's fields, which are read-only here and only
 * ever written through the separate Trainer-side action/route.
 */
export function SignOffPanel({
  signOff,
  action,
}: {
  signOff: SignOffState;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const nameRef = useRef<HTMLInputElement>(null);
  // The server row is already written by the time the action resolves — this
  // just avoids waiting on a full page reload to reflect it here.
  const [justSignedName, setJustSignedName] = useState<string | null>(null);
  const alreadySigned = !!signOff?.traineeSignedAt || !!justSignedName;

  useEffect(() => {
    if (state?.success && nameRef.current) setJustSignedName(nameRef.current.value);
  }, [state]);

  return (
    <div className="mt-6 grid gap-3 rounded-lg border p-4" style={{ borderColor: "var(--deck-border)" }}>
      <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--deck-accent)" }}>
        Certification and Sign-Off
      </p>

      {alreadySigned ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--deck-success)" }}>
          <CheckCircle2 className="size-4 shrink-0" />
          Signed by {justSignedName ?? signOff?.traineeName} on{" "}
          {signOff?.traineeSignedAt ? new Date(signOff.traineeSignedAt).toLocaleDateString("en-AU") : "today"}
        </div>
      ) : (
        <form action={formAction} className="grid gap-2">
          <label className="grid gap-1 text-sm" htmlFor="signoff-trainee-name">
            <span style={{ color: "var(--deck-ink-soft)" }}>Type your full name to confirm you&apos;ve completed this lesson</span>
            <input
              ref={nameRef}
              id="signoff-trainee-name"
              name="traineeName"
              required
              maxLength={200}
              placeholder="Your full name"
              className="h-9 rounded-md border px-3 text-sm"
              style={{ borderColor: "var(--deck-border)", backgroundColor: "var(--deck-surface-sunken)" }}
            />
          </label>
          {state?.error && (
            <p className="text-sm" style={{ color: "var(--deck-warning)" }}>
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-fit" size="sm">
            {pending ? "Signing…" : "Sign"}
          </Button>
        </form>
      )}

      {signOff?.trainerResult && (
        <div
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--deck-border)", backgroundColor: "var(--deck-surface-sunken)" }}
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0" style={{ color: "var(--deck-accent)" }} />
          <div>
            <p className="font-medium">
              Trainer review: {signOff.trainerResult === "PASS" ? "Pass" : "Referred for review"}
            </p>
            <p className="text-xs" style={{ color: "var(--deck-ink-soft)" }}>
              {signOff.trainerName}
              {signOff.trainerSignedAt && ` · ${new Date(signOff.trainerSignedAt).toLocaleDateString("en-AU")}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
