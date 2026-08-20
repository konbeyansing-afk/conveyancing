"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { FormDialog } from "@/components/admin/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createStage, updateStage } from "@/lib/actions/stages";

type StageOption = { id: string; title: string; order: number };
type QuizOption = { id: string; title: string };

export function CreateStageDialog({
  programId,
  stageOptions,
}: {
  programId: string;
  stageOptions: StageOption[];
}) {
  const action = createStage.bind(null, programId);
  const lastStage = [...stageOptions].sort((a, b) => b.order - a.order)[0];

  return (
    <FormDialog
      trigger={
        <>
          <Plus /> Add Stage
        </>
      }
      title="Add stage"
      description='A stage is a major step in the training journey, e.g. "Software & Systems."'
      action={action}
      submitLabel="Create stage"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="stage-title">Stage name</Label>
        <Input id="stage-title" name="title" required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="stage-description">Description</Label>
        <Textarea id="stage-description" name="description" rows={3} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="stage-prerequisite">Prerequisite stage</Label>
        <select
          id="stage-prerequisite"
          name="prerequisiteStageId"
          defaultValue={lastStage?.id ?? ""}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">None — always unlocked</option>
          {stageOptions.map((s) => (
            <option key={s.id} value={s.id}>
              Stage {s.order + 1} — {s.title}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Trainees can&apos;t access this stage until the prerequisite is complete.
        </p>
      </div>
    </FormDialog>
  );
}

export function EditStageDialog({
  programId,
  stageId,
  title,
  description,
  isPublished,
  prerequisiteStageId,
  requireAllLessons,
  requireQuizPass,
  requireTrainerApproval,
  gatingQuizId,
  minQuizScore,
  stageOptions,
  quizOptions,
}: {
  programId: string;
  stageId: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  prerequisiteStageId: string | null;
  requireAllLessons: boolean;
  requireQuizPass: boolean;
  requireTrainerApproval: boolean;
  gatingQuizId: string | null;
  minQuizScore: number | null;
  stageOptions: StageOption[];
  quizOptions: QuizOption[];
}) {
  const action = updateStage.bind(null, programId, stageId);
  const [quizPassChecked, setQuizPassChecked] = useState(requireQuizPass);
  const otherStages = stageOptions.filter((s) => s.id !== stageId);

  return (
    <FormDialog
      trigger={
        <>
          <Pencil /> Edit
        </>
      }
      triggerVariant="outline"
      title="Edit stage"
      action={action}
      submitLabel="Save changes"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="edit-stage-title">Stage name</Label>
        <Input id="edit-stage-title" name="title" defaultValue={title} required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-stage-description">Description</Label>
        <Textarea
          id="edit-stage-description"
          name="description"
          defaultValue={description ?? ""}
          rows={3}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-stage-prerequisite">Prerequisite stage</Label>
        <select
          id="edit-stage-prerequisite"
          name="prerequisiteStageId"
          defaultValue={prerequisiteStageId ?? ""}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">None — always unlocked</option>
          {otherStages.map((s) => (
            <option key={s.id} value={s.id}>
              Stage {s.order + 1} — {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Stage completion requirements</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requireAllLessons"
            defaultChecked={requireAllLessons}
            className="size-4 rounded border-border"
          />
          Complete all lessons in this stage
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requireQuizPass"
            defaultChecked={requireQuizPass}
            onChange={(e) => setQuizPassChecked(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Pass a minimum quiz score
        </label>
        {quizPassChecked && (
          <div className="ml-6 grid gap-2 border-l pl-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-stage-gating-quiz" className="text-xs">
                Gating quiz
              </Label>
              <select
                id="edit-stage-gating-quiz"
                name="gatingQuizId"
                defaultValue={gatingQuizId ?? ""}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a quiz…</option>
                {quizOptions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
              {quizOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No quizzes exist under this stage&apos;s courses yet.
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-stage-min-score" className="text-xs">
                Minimum score (%)
              </Label>
              <Input
                id="edit-stage-min-score"
                name="minQuizScore"
                type="number"
                min={0}
                max={100}
                defaultValue={minQuizScore ?? 80}
                className="w-24"
              />
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requireTrainerApproval"
            defaultChecked={requireTrainerApproval}
            className="size-4 rounded border-border"
          />
          Requires trainer approval
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={isPublished}
          className="size-4 rounded border-border"
        />
        Published (visible to trainees as unlocked/current)
      </label>
    </FormDialog>
  );
}
