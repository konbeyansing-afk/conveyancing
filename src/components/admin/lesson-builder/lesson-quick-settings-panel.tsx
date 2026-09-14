"use client";

import { useActionState, useRef } from "react";
import { Loader2, Check } from "lucide-react";
import { updateLessonDetails } from "@/lib/actions/lessons";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PublishLessonDialog } from "./publish-lesson-dialog";
import type { CompletionRequirement, Difficulty, LessonType } from "@prisma/client";

const LESSON_TYPES: { value: LessonType; label: string }[] = [
  { value: "STANDARD", label: "Standard Lesson" },
  { value: "VIDEO", label: "Video Lesson" },
  { value: "READING", label: "Reading" },
  { value: "PRACTICAL", label: "Practical Exercise" },
  { value: "QUIZ", label: "Quiz" },
  { value: "ASSESSMENT", label: "Assessment" },
];

export function LessonQuickSettingsPanel({
  programId,
  courseId,
  lessonId,
  title,
  description,
  lessonType,
  difficulty,
  estimatedMinutes,
  completionRequirement,
  requiresSignOff,
  hasQuiz,
  isPublished,
  readiness,
  publishAction,
}: {
  programId: string;
  courseId: string;
  lessonId: string;
  title: string;
  description: string | null;
  lessonType: LessonType;
  difficulty: Difficulty;
  estimatedMinutes: number | null;
  completionRequirement: CompletionRequirement;
  requiresSignOff: boolean;
  hasQuiz: boolean;
  isPublished: boolean;
  readiness: { ok: boolean; missing: string[] };
  publishAction: (formData: FormData) => Promise<void>;
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
    <div className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Lesson Settings</p>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : state?.savedAt ? (
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : null}
      </div>

      <form
        ref={formRef}
        action={formAction}
        onChange={scheduleAutosave}
        className="grid gap-4"
      >
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="description" value={description ?? ""} />

        <div className="grid gap-1.5">
          <Label htmlFor="quick-lessonType" className="text-xs uppercase tracking-wide text-muted-foreground">
            Lesson Type
          </Label>
          <select
            id="quick-lessonType"
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
          <Label htmlFor="quick-duration" className="text-xs uppercase tracking-wide text-muted-foreground">
            Duration (minutes)
          </Label>
          <input
            id="quick-duration"
            name="estimatedMinutes"
            type="number"
            min={0}
            defaultValue={estimatedMinutes ?? ""}
            placeholder="e.g. 15"
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <input type="hidden" name="difficulty" value={difficulty} />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Completion Requirement
          </Label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="completionRequirement"
              value="VIEW_ALL"
              defaultChecked={completionRequirement === "VIEW_ALL"}
              className="mt-0.5"
            />
            Must view all content
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="completionRequirement"
              value="PASS_QUIZ"
              defaultChecked={completionRequirement === "PASS_QUIZ"}
              disabled={!hasQuiz}
              className="mt-0.5"
            />
            <span className={hasQuiz ? "" : "text-muted-foreground"}>
              Must pass quiz{!hasQuiz && " (add a knowledge check in Settings first)"}
            </span>
          </label>
        </div>

        <div className="grid gap-1.5 border-t pt-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sign-Off</Label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="requiresSignOff" defaultChecked={requiresSignOff} className="mt-0.5" />
            Require a sign-off before this lesson can be completed
          </label>
          <p className="text-xs text-muted-foreground">
            Adds a name/confirmation field the trainee fills in themselves at the end of the lesson, and a
            separate Pass/Refer for Review a Trainer or Admin records afterward. The trainer&apos;s review does
            not block the trainee&apos;s own completion.
          </p>
        </div>
      </form>

      <div className="grid gap-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Status
          </span>
          {isPublished ? (
            <Badge className="bg-primary/10 text-primary">Published</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Draft
            </Badge>
          )}
        </div>
        {!isPublished && (
          <PublishLessonDialog ready={readiness.ok} missing={readiness.missing} publishAction={publishAction} />
        )}
      </div>
    </div>
  );
}
