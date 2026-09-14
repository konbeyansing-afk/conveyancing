"use client";

import { useActionState, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { submitTrainerSignOff } from "@/lib/actions/lesson-signoff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SignOffResult } from "@prisma/client";

/**
 * The Trainer/Admin half of a lesson sign-off — independent of, and never
 * gating, the trainee's own completion (see markLessonComplete). Existing
 * fields render read-only above this form once a review has been recorded;
 * resubmitting updates the same row (a Trainer can change their mind).
 */
export function TrainerSignOffForm({
  lessonId,
  traineeId,
  existing,
}: {
  lessonId: string;
  traineeId: string;
  existing: { trainerName: string | null; trainerResult: SignOffResult | null; trainerNotes: string | null } | null;
}) {
  const action = submitTrainerSignOff.bind(null, lessonId, traineeId);
  const [state, formAction, pending] = useActionState(action, null);
  const [result, setResult] = useState<SignOffResult>(existing?.trainerResult ?? "PASS");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trainer Sign-Off</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="trainer-signoff-name">Your name</Label>
            <Input
              id="trainer-signoff-name"
              name="trainerName"
              defaultValue={existing?.trainerName ?? ""}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Result</Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="result"
                value="PASS"
                checked={result === "PASS"}
                onChange={() => setResult("PASS")}
              />
              Pass
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="result"
                value="REFER"
                checked={result === "REFER"}
                onChange={() => setResult("REFER")}
              />
              Refer for Review
            </label>
          </div>

          {result === "REFER" && (
            <div className="grid gap-1.5">
              <Label htmlFor="trainer-signoff-notes">Reason (required)</Label>
              <Textarea
                id="trainer-signoff-notes"
                name="trainerNotes"
                defaultValue={existing?.trainerNotes ?? ""}
                rows={2}
                placeholder="What needs to be revisited?"
              />
            </div>
          )}

          {state?.error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p role="status" className="text-sm font-medium text-success">
              {state.success}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-fit">
            <BadgeCheck className="size-3.5" />
            {pending ? "Saving…" : existing ? "Update Sign-Off" : "Submit Sign-Off"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
