"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Rocket, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  backHref,
  backLabel,
  breadcrumb,
  lessonTitle,
  isPublished,
  detailsDone,
  contentDone,
  unpublishAction,
  detailsSlot,
  contentSlot,
  resourcesSlot,
  settingsSlot,
  previewSlot,
  publishSlot,
}: {
  backHref: string;
  backLabel: string;
  breadcrumb: string;
  lessonTitle: string;
  isPublished: boolean;
  detailsDone: boolean;
  contentDone: boolean;
  unpublishAction: (formData: FormData) => Promise<void>;
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
      {/* Sticky while editing, but static in Preview so it scrolls away instead
          of covering the lesson content the way a trainee would never see it. */}
      <div
        className={
          isPreview
            ? "-mx-4 -mt-4 min-w-0 border-b bg-background px-4 pt-4 pb-3"
            : "sticky top-14 z-20 -mx-4 -mt-4 min-w-0 border-b bg-background/95 px-4 pt-4 pb-3 backdrop-blur-sm"
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> {backLabel}
            </Link>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-balance">{lessonTitle || "New Lesson"}</h1>
              {isPublished ? (
                <Badge className="bg-primary/10 text-primary">Published</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Draft
                </Badge>
              )}
            </div>
            <p className="mf-mono text-xs text-muted-foreground">{breadcrumb}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isPublished ? (
              <form action={unpublishAction}>
                <Button type="submit" variant="outline" size="sm">
                  Unpublish
                </Button>
              </form>
            ) : (
              <Button size="sm" onClick={() => setStep("publish")}>
                <Rocket /> Publish Lesson
              </Button>
            )}
          </div>
        </div>

        {step === "preview" ? (
          <button
            type="button"
            onClick={() => setStep("details")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/70"
          >
            <X className="size-3.5" /> Exit Preview
          </button>
        ) : (
          <Stepper
            className="mt-3"
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
