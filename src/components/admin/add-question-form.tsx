"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";

export function AddQuestionForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [type, setType] = useState<QuestionType>("MULTIPLE_CHOICE");

  return (
    <form
      action={async (formData) => {
        await action(formData);
        setType("MULTIPLE_CHOICE");
      }}
      className="grid gap-3 rounded-md border border-border/60 p-3"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="prompt">Question</Label>
        <Textarea id="prompt" name="prompt" required rows={2} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          className="h-8 w-fit rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="MULTIPLE_CHOICE">Multiple choice</option>
          <option value="TRUE_FALSE">True / False</option>
          <option value="SHORT_ANSWER">Short answer</option>
        </select>
      </div>

      {type === "MULTIPLE_CHOICE" && (
        <div className="grid gap-2">
          <Label>Choices (mark the correct one)</Label>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctIndex"
                value={i}
                defaultChecked={i === 0}
                className="size-4"
                aria-label={`Choice ${i + 1} is correct`}
              />
              <Input
                name={`choice${i}`}
                placeholder={`Choice ${i + 1}${i < 2 ? " (required)" : " (optional)"}`}
                required={i < 2}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )}

      {type === "TRUE_FALSE" && (
        <div className="grid gap-1.5">
          <Label>Correct answer</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="correctBool" value="true" defaultChecked className="size-4" />
              True
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="correctBool" value="false" className="size-4" />
              False
            </label>
          </div>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="explanation">
          Explanation <span className="text-muted-foreground">(shown to trainees after they answer)</span>
        </Label>
        <Textarea id="explanation" name="explanation" rows={2} />
      </div>

      <Button type="submit" size="sm" className="w-fit">
        Add question
      </Button>
    </form>
  );
}
