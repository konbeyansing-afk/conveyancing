"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Eye, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Step = { title: string; html: string };
type Resource = { id: string; title: string; url: string; fileType: string };

export function InteractiveLessonViewer({
  steps,
  lessonTitle,
  moduleTitle,
  backHref,
  backLabel,
  onComplete,
  quizHref,
  isDraftPreview,
  resources,
  embedded,
}: {
  steps: Step[];
  lessonTitle: string;
  moduleTitle: string;
  backHref: string;
  backLabel: string;
  onComplete: () => Promise<{
    ok: boolean;
    reason?: "quiz_required" | "stage_locked";
    stageJustCompleted?: { id: string; title: string };
  }>;
  quizHref?: string;
  isDraftPreview?: boolean;
  resources?: Resource[];
  /** Rendered inside the Lesson Builder preview step: stays in its container
   *  instead of breaking out full-bleed, and drops the redundant back-link. */
  embedded?: boolean;
}) {
  const total = steps.length;
  const [step, setStep] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const focusTarget = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusTarget.current?.focus();
  }, [step, showComplete]);

  // Scratchpad answer boxes: under each numbered question in reflection/scenario/exercise
  // stages, so trainees can think out loud as they read. Not saved anywhere on purpose.
  useEffect(() => {
    if (showComplete) return;
    const container = contentRef.current;
    const title = steps[step]?.title ?? "";
    if (!container || !/reflection|practical scenario|practical exercise/i.test(title)) return;

    const paragraphs = Array.from(container.querySelectorAll(":scope > p"));
    for (const p of paragraphs) {
      if (p.nextElementSibling?.classList.contains("mf-scratch-answer")) continue;
      const text = p.textContent?.trim() ?? "";
      if (!/^\d+[.)]\s*\S/.test(text)) continue;

      const wrapper = document.createElement("div");
      wrapper.className = "mf-scratch-answer mt-2 mb-4";
      wrapper.style.cssText = "margin-top: 0.5rem; margin-bottom: 1rem;";

      const label = document.createElement("label");
      label.className = "mf-mono";
      label.textContent = "Jot your answer";
      label.style.cssText =
        "display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem; color: var(--mf-ink-soft);";

      const textarea = document.createElement("textarea");
      textarea.rows = 3;
      textarea.placeholder = "Type your thinking here — this is just for you, it isn't saved.";
      textarea.style.cssText =
        "width: 100%; border-radius: 0.5rem; border: 1px solid var(--mf-line); background: var(--mf-paper); padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--mf-ink); resize: vertical;";

      wrapper.appendChild(label);
      wrapper.appendChild(textarea);
      p.insertAdjacentElement("afterend", wrapper);
    }
  }, [step, showComplete, steps]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, showComplete, completing]);

  async function goNext() {
    if (completing) return;
    if (showComplete) return;
    if (step < total - 1) {
      setStep((current) => current + 1);
      return;
    }
    setCompleting(true);
    try {
      const result = await onComplete();
      if (result.ok) {
        setBlocked(false);
        setShowComplete(true);
        if (result.stageJustCompleted) {
          toast.success("Stage complete!", {
            description: `You've completed "${result.stageJustCompleted.title}" — your next stage is now unlocked.`,
          });
        }
      } else {
        setBlocked(true);
      }
    } finally {
      setCompleting(false);
    }
  }

  function goPrev() {
    if (showComplete) {
      setShowComplete(false);
      return;
    }
    if (step > 0) setStep((current) => current - 1);
  }

  const progressCount = showComplete ? total : step;

  return (
    <div
      className={`matter-file-theme px-4 py-6 sm:px-8 sm:py-10 ${
        embedded ? "rounded-xl border" : "-m-4 min-h-[calc(100vh-3.5rem)]"
      }`}
      style={embedded ? { borderColor: "var(--mf-line)" } : undefined}
    >
      <div className="mx-auto max-w-5xl">
        {isDraftPreview && (
          <div
            className="mb-4 flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
            style={{ borderColor: "var(--mf-brass)", color: "var(--mf-brass-dark)" }}
          >
            <Eye className="size-4 shrink-0" />
            You&apos;re previewing this as staff — it&apos;s not published, so trainees can&apos;t see it yet.
          </div>
        )}
        {!embedded && (
          <Link
            href={backHref}
            className="mf-mono inline-flex items-center gap-1.5 text-xs uppercase tracking-wide"
            style={{ color: "var(--mf-ink-soft)" }}
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </Link>
        )}

        <p
          className={`mf-mono text-xs uppercase tracking-wide ${embedded ? "" : "mt-3"}`}
          style={{ color: "var(--mf-brass-dark)" }}
        >
          {moduleTitle}
        </p>
        <h1 className="mf-display text-3xl font-medium sm:text-4xl">{lessonTitle}</h1>

        {/* Mobile progress strip */}
        <div className="mt-6 flex items-center gap-1 sm:hidden">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{
                backgroundColor: i < progressCount || showComplete ? "var(--mf-brass)" : "var(--mf-line)",
              }}
            />
          ))}
        </div>
        <p className="mf-mono mt-2 text-xs sm:hidden" style={{ color: "var(--mf-ink-soft)" }}>
          {showComplete ? `Sealed — ${total}/${total}` : `Stage ${step + 1} of ${total}`}
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-[220px_1fr]">
          {/* Desktop rail */}
          <ol className="hidden sm:block">
            {steps.map((s, i) => {
              const state = showComplete || i < step ? "done" : i === step ? "current" : "upcoming";
              return (
                <li key={i} className="relative flex gap-3 pb-6 last:pb-0">
                  {i < steps.length - 1 && (
                    <span
                      className="absolute top-6 left-[11px] h-[calc(100%-0.5rem)] w-px"
                      style={{ backgroundColor: state === "done" ? "var(--mf-brass)" : "var(--mf-line)" }}
                    />
                  )}
                  <span
                    className="mf-rail-node mf-mono relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]"
                    style={{
                      borderColor: state === "upcoming" ? "var(--mf-line)" : "var(--mf-brass)",
                      backgroundColor: state === "done" ? "var(--mf-brass)" : "var(--mf-paper-raised)",
                      color: state === "done" ? "var(--mf-paper)" : state === "current" ? "var(--mf-brass-dark)" : "var(--mf-ink-soft)",
                    }}
                  >
                    {state === "done" ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (i <= step || showComplete) {
                        setShowComplete(false);
                        setStep(i);
                      }
                    }}
                    disabled={i > step && !showComplete}
                    className="pt-0.5 text-left text-sm leading-tight disabled:cursor-not-allowed"
                    style={{
                      color: state === "current" ? "var(--mf-ink)" : "var(--mf-ink-soft)",
                      fontWeight: state === "current" ? 600 : 400,
                    }}
                  >
                    {s.title}
                  </button>
                </li>
              );
            })}
            <li className="flex gap-3">
              <span
                className="mf-mono flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]"
                style={{
                  borderColor: showComplete ? "var(--mf-eucalyptus)" : "var(--mf-line)",
                  backgroundColor: showComplete ? "var(--mf-eucalyptus)" : "var(--mf-paper-raised)",
                  color: showComplete ? "var(--mf-paper)" : "var(--mf-ink-soft)",
                }}
              >
                {showComplete ? <Check className="size-3.5" /> : "◆"}
              </span>
              <span
                className="pt-0.5 text-sm"
                style={{ color: showComplete ? "var(--mf-eucalyptus)" : "var(--mf-ink-soft)", fontWeight: showComplete ? 600 : 400 }}
              >
                Sealed
              </span>
            </li>
          </ol>

          {/* Content panel */}
          <div
            key={showComplete ? "complete" : step}
            className="mf-step-enter rounded-xl border p-6 sm:p-8"
            style={{ backgroundColor: "var(--mf-paper-raised)", borderColor: "var(--mf-line)" }}
          >
            {showComplete ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div
                  className="mf-seal mf-mono flex size-24 items-center justify-center rounded-full border-2 text-sm font-semibold uppercase tracking-widest"
                  style={{ borderColor: "var(--mf-eucalyptus)", color: "var(--mf-eucalyptus)" }}
                >
                  Sealed
                </div>
                <h2 ref={focusTarget} tabIndex={-1} className="mf-display mt-6 text-2xl font-medium outline-none">
                  Matter complete
                </h2>
                <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--mf-ink-soft)" }}>
                  You&apos;ve worked through every stage of &ldquo;{lessonTitle}.&rdquo; This lesson is now marked
                  complete on your record.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {quizHref && (
                    <Button
                      nativeButton={false}
                      style={{ backgroundColor: "var(--mf-brass)", color: "var(--mf-paper)" }}
                      render={<Link href={quizHref} />}
                    >
                      Take the knowledge check
                    </Button>
                  )}
                  <Button variant="outline" nativeButton={false} render={<Link href={backHref} />}>
                    {backLabel}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mf-mono text-xs uppercase tracking-wide" style={{ color: "var(--mf-brass-dark)" }}>
                  Stage {step + 1} of {total}
                </p>
                <h2 ref={focusTarget} tabIndex={-1} className="mf-display mt-1 text-2xl font-medium outline-none">
                  {steps[step].title}
                </h2>
                <div
                  ref={contentRef}
                  className="lesson-content mt-4"
                  dangerouslySetInnerHTML={{ __html: steps[step].html }}
                />
              </>
            )}

            {!showComplete && blocked && (
              <p
                className="mt-6 rounded-md border border-dashed px-3 py-2 text-sm"
                style={{ borderColor: "var(--mf-clay)", color: "var(--mf-clay)" }}
              >
                You need to pass the knowledge check before this lesson can be marked complete.
                {quizHref && (
                  <>
                    {" "}
                    <Link href={quizHref} className="underline">
                      Take the knowledge check
                    </Link>
                  </>
                )}
              </p>
            )}

            {!showComplete && (
              <div className="mt-8 flex items-center justify-between border-t pt-6" style={{ borderColor: "var(--mf-line)" }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goPrev}
                  disabled={step === 0}
                  style={{ color: "var(--mf-ink-soft)" }}
                >
                  <ArrowLeft /> Back
                </Button>
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={completing}
                  style={{ backgroundColor: "var(--mf-brass)", color: "var(--mf-paper)" }}
                >
                  {completing ? "Sealing…" : step === total - 1 ? "Seal this matter" : "Continue"}
                  {!completing && <ArrowRight />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {resources && resources.length > 0 && (
          <div className="mt-8 rounded-xl border p-5 sm:p-6" style={{ borderColor: "var(--mf-line)" }}>
            <p className="mf-mono text-xs uppercase tracking-wide" style={{ color: "var(--mf-brass-dark)" }}>
              Lesson resources
            </p>
            <ul className="mt-3 grid gap-2">
              {resources.map((resource) => (
                <li key={resource.id}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-black/[0.02]"
                    style={{ borderColor: "var(--mf-line)", color: "var(--mf-ink)" }}
                  >
                    <FileText className="size-4 shrink-0" style={{ color: "var(--mf-brass-dark)" }} />
                    <span className="flex-1">
                      {resource.title}{" "}
                      <span style={{ color: "var(--mf-ink-soft)" }}>· {resource.fileType}</span>
                    </span>
                    <ExternalLink className="size-3.5 shrink-0" style={{ color: "var(--mf-ink-soft)" }} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
