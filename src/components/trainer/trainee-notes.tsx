"use client";

import { useActionState } from "react";
import { StickyNote, Trash2 } from "lucide-react";
import {
  addTraineeNote,
  deleteTraineeNote,
  type TrainerActionState,
} from "@/lib/actions/trainer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Note = {
  id: string;
  body: string;
  createdAt: Date;
  author: { name: string };
  canDelete: boolean;
};

function DeleteNoteButton({ noteId }: { noteId: string }) {
  const action = deleteTraineeNote.bind(null, noteId);
  const [, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" size="sm" disabled={pending} aria-label="Delete note">
        <Trash2 className="size-3.5" />
      </Button>
    </form>
  );
}

function Feedback({ state }: { state: TrainerActionState }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive">
        {state.error}
      </p>
    );
  }
  return null;
}

export function TraineeNotes({ traineeId, notes }: { traineeId: string; notes: Note[] }) {
  const action = addTraineeNote.bind(null, traineeId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="size-4 text-primary" />
          Trainer notes
        </CardTitle>
        <CardDescription>
          Only trainers and admins can see these. The trainee cannot.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form action={formAction} className="grid gap-2">
          <Textarea
            name="body"
            rows={3}
            required
            placeholder="What did you observe? What should the next person picking this up know?"
          />
          <Feedback state={state} />
          <Button type="submit" size="sm" disabled={pending} className="w-fit">
            {pending ? "Saving…" : "Add note"}
          </Button>
        </form>

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="grid gap-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap">{note.body}</p>
                  {note.canDelete && <DeleteNoteButton noteId={note.id} />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.author.name} ·{" "}
                  {note.createdAt.toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
