"use client";

import { useActionState, useRef } from "react";
import { Loader2, Check } from "lucide-react";
import { updateLessonDetails } from "@/lib/actions/lessons";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LessonSetupChecklist } from "./lesson-setup-checklist";
import type { Difficulty, LessonType } from "@prisma/client";

const LESSON_TYPES: { value: LessonType; label: string }[] = [
  { value: "STANDARD", label: "Standard Lesson" },
  { value: "VIDEO", label: "Video Lesson" },
  { value: "READING", label: "Reading" },
  { value: "PRACTICAL", label: "Practical Exercise" },
  { value: "QUIZ", label: "Quiz" },
  { value: "ASSESSMENT", label: "Assessment" },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

// Plain native input (not the Base UI–wrapped `Input`) — this field's `defaultValue` legitimately
// changes across the autosave-triggered server refresh, which Base UI's uncontrolled-field
// tracking flags as a dev warning even though nothing is actually broken.
const inputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30";

export function LessonDetailsForm({
  programId,
  courseId,
  lessonId,
  title,
  description,
  lessonType,
  difficulty,
  estimatedMinutes,
  hasContent,
}: {
  programId: string;
  courseId: string;
  lessonId: string;
  title: string;
  description: string | null;
  lessonType: LessonType;
  difficulty: Difficulty;
  estimatedMinutes: number | null;
  hasContent: boolean;
}) {
  const action = updateLessonDetails.bind(null, programId, courseId, lessonId);
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleAutosave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => formRef.current?.requestSubmit(), 900);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <Card>
        <CardHeader>
          <CardTitle>Lesson details</CardTitle>
          <CardDescription>The basics trainees see before they start this lesson.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            action={formAction}
            onChange={scheduleAutosave}
            className="grid max-w-xl gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="lesson-details-title">Title</Label>
              <input
                id="lesson-details-title"
                name="title"
                defaultValue={title}
                placeholder="e.g. Opening a Matter — Introduction"
                required
                autoFocus
                className={inputClassName}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lesson-details-description">Short description</Label>
              <Textarea
                id="lesson-details-description"
                name="description"
                defaultValue={description ?? ""}
                placeholder="Learn how to correctly open and establish a new conveyancing matter."
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="lesson-details-type">Lesson type</Label>
                <select
                  id="lesson-details-type"
                  name="lessonType"
                  defaultValue={lessonType}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {LESSON_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lesson-details-difficulty">Difficulty</Label>
                <select
                  id="lesson-details-difficulty"
                  name="difficulty"
                  defaultValue={difficulty}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid max-w-[200px] gap-1.5">
              <Label htmlFor="lesson-details-duration">Estimated duration (minutes)</Label>
              <input
                id="lesson-details-duration"
                name="estimatedMinutes"
                type="number"
                min={0}
                defaultValue={estimatedMinutes ?? ""}
                placeholder="e.g. 15"
                className={inputClassName}
              />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          </form>
        </CardContent>
      </Card>

      <div className="grid content-start gap-3">
        <div className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </>
          ) : state?.savedAt ? (
            <>
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Saved
            </>
          ) : (
            "Autosaves as you type"
          )}
        </div>
        <LessonSetupChecklist
          items={[
            { label: "Title", done: title.trim().length > 0, required: true },
            { label: "Description", done: !!description?.trim() },
            { label: "Estimated duration", done: !!estimatedMinutes },
            { label: "Lesson content", done: hasContent, required: true },
          ]}
        />
      </div>
    </div>
  );
}
