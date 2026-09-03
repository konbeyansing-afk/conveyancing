"use client";

import { useState, type ReactNode } from "react";
import { Eye, X } from "lucide-react";
import { Stepper, type StepperStep } from "@/components/ui/stepper";

type StepKey = "details" | "content" | "resources" | "settings" | "preview" | "publish";

const STEPS: StepperStep[] = [
  { key: "details", label: "Details" },
  { key: "content", label: "Content" },
  { key: "resources", label: "Resources" },
  { key: "settings", label: "Settings" },
  { key: "preview", label: "Preview", icon: Eye },
  { key: "publish", label: "Publish" },
];

export function LessonBuilderShell({
  detailsDone,
  contentDone,
  isPublished,
  detailsSlot,
  contentSlot,
  resourcesSlot,
  settingsSlot,
  previewSlot,
  publishSlot,
}: {
  detailsDone: boolean;
  contentDone: boolean;
  isPublished: boolean;
  detailsSlot: ReactNode;
  contentSlot: ReactNode;
  resourcesSlot: ReactNode;
  settingsSlot: ReactNode;
  previewSlot: ReactNode;
  publishSlot: ReactNode;
}) {
  const [step, setStep] = useState<StepKey>("details");

  const doneKeys = new Set<string>([
    ...(detailsDone ? (["details"] as const) : []),
    ...(contentDone ? (["content"] as const) : []),
    ...(isPublished ? (["publish"] as const) : []),
  ]);

  const slots: Record<StepKey, ReactNode> = {
    details: detailsSlot,
    content: contentSlot,
    resources: resourcesSlot,
    settings: settingsSlot,
    preview: previewSlot,
    publish: publishSlot,
  };

  const isPreview = step === "preview";

  return (
    <div className="grid min-w-0 gap-6">
      {/* Sticky step nav while editing, but static in Preview so it scrolls
          away instead of covering the lesson content a trainee would see. */}
      <div
        className={
          isPreview
            ? "-mx-4 -mt-4 min-w-0 border-b bg-background px-4 pt-4 pb-3"
            : "sticky top-14 z-20 -mx-4 -mt-4 min-w-0 border-b bg-background/95 px-4 pt-4 pb-3 backdrop-blur-sm"
        }
      >
        {isPreview ? (
          <button
            type="button"
            onClick={() => setStep("details")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/70"
          >
            <X className="size-3.5" /> Exit Preview
          </button>
        ) : (
          <Stepper
            steps={STEPS}
            currentKey={step}
            doneKeys={doneKeys}
            onStepClick={(key) => setStep(key as StepKey)}
          />
        )}
      </div>

      <div>{slots[step]}</div>
    </div>
  );
}
