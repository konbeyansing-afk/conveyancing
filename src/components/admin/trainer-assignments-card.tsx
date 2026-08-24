"use client";

import { useActionState, useState } from "react";
import { UserPlus, X } from "lucide-react";
import {
  assignTraineeToTrainer,
  unassignTraineeFromTrainer,
  type TrainerActionState,
} from "@/lib/actions/trainer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type TrainerWithTrainees = {
  id: string;
  name: string;
  email: string;
  trainees: { id: string; name: string }[];
};

const selectClass =
  "h-8 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm disabled:opacity-50";

function Feedback({ state }: { state: TrainerActionState }) {
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

function UnassignButton({ trainerId, traineeId }: { trainerId: string; traineeId: string }) {
  const [, formAction, pending] = useActionState(unassignTraineeFromTrainer, null);
  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="trainerId" value={trainerId} />
      <input type="hidden" name="traineeId" value={traineeId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Remove assignment"
        className="rounded-full p-0.5 hover:bg-muted disabled:opacity-50"
      >
        <X className="size-3" />
      </button>
    </form>
  );
}

/**
 * Who supervises whom. A trainer only ever sees the trainees listed against
 * them here — this card is the whole of that decision, and only an admin can
 * change it.
 */
export function TrainerAssignmentsCard({
  trainers,
  trainees,
}: {
  trainers: TrainerWithTrainees[];
  trainees: { id: string; name: string; email: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignTraineeToTrainer, null);
  const [selectedTrainer, setSelectedTrainer] = useState(trainers[0]?.id ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trainer assignments</CardTitle>
        <CardDescription>
          Trainers can only see and sign off the trainees assigned to them here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {trainers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No trainers yet. Create one from the Users page, then assign trainees to them here.
          </p>
        ) : (
          <>
            <form action={formAction} className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="trainerId">Trainer</Label>
                <select
                  id="trainerId"
                  name="trainerId"
                  className={selectClass}
                  value={selectedTrainer}
                  onChange={(e) => setSelectedTrainer(e.target.value)}
                >
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="traineeId">Trainee</Label>
                <select
                  id="traineeId"
                  name="traineeId"
                  className={selectClass}
                  disabled={trainees.length === 0}
                >
                  {trainees.map((trainee) => (
                    <option key={trainee.id} value={trainee.id}>
                      {trainee.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" size="sm" disabled={pending || trainees.length === 0}>
                <UserPlus className="size-3.5" />
                {pending ? "Assigning…" : "Assign"}
              </Button>
            </form>

            <Feedback state={state} />

            <div className="grid gap-2">
              {trainers.map((trainer) => (
                <div key={trainer.id} className="rounded-lg border px-3 py-2">
                  <p className="text-sm font-medium">{trainer.name}</p>
                  {trainer.trainees.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No trainees assigned.</p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {trainer.trainees.map((trainee) => (
                        <Badge key={trainee.id} variant="outline" className="gap-1 pr-1">
                          {trainee.name}
                          <UnassignButton trainerId={trainer.id} traineeId={trainee.id} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
