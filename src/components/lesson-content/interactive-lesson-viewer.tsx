"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  FileText,
  ExternalLink,
  Maximize,
  Minimize,
  Target,
  AlertTriangle,
  Lightbulb,
  CheckSquare,
  Flag,
  Compass,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { TrainingJurisdiction } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { SignOffPanel, type SignOffState } from "@/components/lesson-content/sign-off-panel";
import { JurisdictionBadge, LessonIntroScreen, type LessonProgressState } from "@/components/lesson-content/lesson-intro-screen";
import { classifySlideFlavor, type SlideFlavor } from "@/lib/lesson-slide-flavor";

type Step = { title: string; html: string };
type Resource = { id: string; title: string; url: string; fileType: string };
type SignOffActionResult = { error?: string; success?: string } | null;
type QuizMeta = { title: string; questionCount: number; passingScore: number };
type CompleteReason = "quiz_required" | "stage_locked" | "signoff_required";

const FLAVOR_META: Record<SlideFlavor, { label: string; icon: typeof BookOpen; accent: string; accentSoft: string }> = {
  objectives: { label: "Objectives", icon: Target, accent: "var(--deck-accent)", accentSoft: "var(--deck-accent-soft)" },
  warning: { label: "Important", icon: AlertTriangle, accent: "var(--deck-warning)", accentSoft: "var(--deck-warning-soft)" },
  tip: { label: "Tip", icon: Lightbulb, accent: "var(--deck-success)", accentSoft: "var(--deck-success-soft)" },
  checklist: { label: "Checklist", icon: CheckSquare, accent: "var(--deck-accent)", accentSoft: "var(--deck-accent-soft)" },
  summary: { label: "Key Takeaways", icon: Flag, accent: "var(--deck-ink)", accentSoft: "var(--deck-surface-sunken)" },
  example: { label: "Example", icon: Compass, accent: "var(--deck-accent)", accentSoft: "var(--deck-accent-soft)" },
  content: { label: "Content", icon: BookOpen, accent: "var(--deck-ink-soft)", accentSoft: "var(--deck-surface-sunken)" },
};

/**
 * Focuses an element the moment it mounts. Deliberately scoped to a component
 * that itself remounts per slide (rather than a ref shared from the outer
 * viewer) — AnimatePresence's mode="wait" defers the real DOM commit for an
 * incoming slide, so an effect driven by the outer `slide` state can fire
 * before that commit happens and silently focus nothing.
 */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable === true;
}

const slideVariants = {
  enter: (direction: number) => ({ x: direction >= 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction >= 0 ? -48 : 48, opacity: 0 }),
};

export function InteractiveLessonViewer({
  steps,
  lessonTitle,
  moduleTitle,
  backHref,
  backLabel,
  onComplete,
  quizHref,
  quizMeta,
  isDraftPreview,
  resources,
  embedded,
  requiresSignOff = false,
  signOff = null,
  onSubmitSignOff,
  jurisdiction = null,
  stageTitle = null,
  estimatedMinutes = null,
  progressState = "not_started",
  nextLessonHref = null,
  nextLessonTitle = null,
}: {
  steps: Step[];
  lessonTitle: string;
  moduleTitle: string;
  backHref: string;
  backLabel: string;
  onComplete: () => Promise<{
    ok: boolean;
    reason?: CompleteReason;
    stageJustCompleted?: { id: string; title: string };
  }>;
  quizHref?: string;
  quizMeta?: QuizMeta;
  isDraftPreview?: boolean;
  resources?: Resource[];
  /** Rendered inside the Lesson Builder preview step: stays in its container
   *  instead of breaking out full-bleed, and skips the entry screen. */
  embedded?: boolean;
  /** Lesson.requiresSignOff — when true, the final content slide shows
   *  SignOffPanel before the trainee can complete the lesson. */
  requiresSignOff?: boolean;
  signOff?: SignOffState;
  onSubmitSignOff?: (state: SignOffActionResult, formData: FormData) => Promise<SignOffActionResult>;
  jurisdiction?: TrainingJurisdiction | null;
  stageTitle?: string | null;
  estimatedMinutes?: number | null;
  progressState?: LessonProgressState;
  nextLessonHref?: string | null;
  nextLessonTitle?: string | null;
}) {
  const totalSteps = steps.length;
  const hasQuizBridge = !!quizHref;
  const totalSlides = 1 + totalSteps + (hasQuizBridge ? 1 : 0);
  const lastSlideIndex = totalSlides - 1;

  const [screen, setScreen] = useState<"intro" | "deck">(embedded ? "deck" : "intro");
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showComplete, setShowComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<CompleteReason | undefined>();
  const [fullscreenSupported] = useState(
    () => typeof document !== "undefined" && document.fullscreenEnabled === true,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const isTitleSlide = slide === 0;
  const realStepIndex = slide - 1;
  const isQuizBridgeSlide = hasQuizBridge && slide === lastSlideIndex;
  const isRealStep = !isTitleSlide && !isQuizBridgeSlide;
  const currentStep = isRealStep ? steps[realStepIndex] : null;
  const flavor = currentStep ? classifySlideFlavor(currentStep.title) : "content";
  const flavorMeta = FLAVOR_META[flavor];

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (screen !== "deck") return;
      if (isTypingTarget(document.activeElement)) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === " " || event.key === "Spacebar") {
        const active = document.activeElement;
        const isButtonLike = active && (active.tagName === "BUTTON" || active.tagName === "A");
        if (isButtonLike) return;
        event.preventDefault();
        goNext();
      } else if (event.key === "Escape" && isFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, slide, showComplete, completing, isFullscreen]);

  async function goNext() {
    if (completing || showComplete) return;
    if (slide < lastSlideIndex) {
      setDirection(1);
      setSlide((current) => current + 1);
      return;
    }
    setCompleting(true);
    try {
      const result = await onComplete();
      if (result.ok) {
        setBlocked(false);
        setBlockedReason(undefined);
        setShowComplete(true);
        if (result.stageJustCompleted) {
          toast.success("Stage complete!", {
            description: `You've completed "${result.stageJustCompleted.title}" — your next stage is now unlocked.`,
          });
        }
      } else {
        setBlocked(true);
        setBlockedReason(result.reason);
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
    if (slide > 0) {
      setDirection(-1);
      setSlide((current) => current - 1);
    }
  }

  function toggleFullscreen() {
    if (!fullscreenSupported) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      rootRef.current?.requestFullscreen().catch(() => {});
    }
  }

  function goToSlide(index: number) {
    if (index === slide) return;
    setDirection(index > slide ? 1 : -1);
    setShowComplete(false);
    setSlide(index);
  }

  const agenda = steps.map((s) => s.title);

  if (screen === "intro") {
    return (
      <div className="lesson-deck-theme -m-4 min-h-[calc(100vh-3.5rem)]">
        {isDraftPreview && <DraftPreviewBanner />}
        <LessonIntroScreen
          lessonTitle={lessonTitle}
          moduleTitle={moduleTitle}
          stageTitle={stageTitle}
          jurisdiction={jurisdiction}
          estimatedMinutes={estimatedMinutes}
          agenda={agenda}
          progressState={progressState}
          onStart={() => setScreen("deck")}
        />
      </div>
    );
  }

  const progressCount = showComplete ? totalSlides : slide + 1;
  const showDots = totalSlides <= 8;

  return (
    <div
      ref={rootRef}
      className={`lesson-deck-theme px-4 py-6 sm:px-8 sm:py-10 ${embedded ? "rounded-xl border" : "-m-4 min-h-[calc(100vh-3.5rem)]"}`}
      style={embedded ? { borderColor: "var(--deck-border)" } : undefined}
    >
      <div className="mx-auto max-w-4xl">
        {isDraftPreview && <DraftPreviewBanner />}

        {!embedded && (
          <div className="flex items-center justify-between gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Exit Lesson
            </Link>
            {fullscreenSupported && (
              <Button type="button" variant="ghost" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
                {isFullscreen ? "Exit Present" : "Present"}
              </Button>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <JurisdictionBadge jurisdiction={jurisdiction} />
          {stageTitle && (
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stageTitle}</span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" style={{ color: "var(--deck-ink)" }}>
          {lessonTitle}
        </h1>

        {/* Progress: dots and/or bar, plus numeric counter — slide progress only, never training completion */}
        <div className="mt-5 flex items-center gap-3">
          {showDots ? (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <span
                  key={i}
                  className="size-2 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      i < progressCount || showComplete ? "var(--deck-accent)" : "var(--deck-border)",
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full" style={{ backgroundColor: "var(--deck-border)" }}>
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${Math.round((progressCount / totalSlides) * 100)}%`,
                  backgroundColor: "var(--deck-accent)",
                }}
              />
            </div>
          )}
          <p className="text-xs font-medium text-muted-foreground tabular-nums">
            {showComplete ? `${totalSlides} / ${totalSlides}` : `Slide ${slide + 1} / ${totalSlides}`}
          </p>
        </div>

        <div className="mt-6 grid gap-8 sm:grid-cols-[220px_1fr]">
          {/* Desktop slide navigator */}
          <ol className="hidden sm:block">
            {Array.from({ length: totalSlides }).map((_, i) => {
              const state = showComplete || i < slide ? "done" : i === slide ? "current" : "upcoming";
              const title =
                i === 0 ? "Title" : hasQuizBridge && i === lastSlideIndex ? "Knowledge Check" : steps[i - 1].title;
              return (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < totalSlides - 1 && (
                    <span
                      className="absolute top-6 left-[11px] h-[calc(100%-0.5rem)] w-px"
                      style={{ backgroundColor: state === "done" ? "var(--deck-accent)" : "var(--deck-border)" }}
                    />
                  )}
                  <span
                    className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium"
                    style={{
                      borderColor: state === "upcoming" ? "var(--deck-border)" : "var(--deck-accent)",
                      backgroundColor: state === "done" ? "var(--deck-accent)" : "var(--deck-surface)",
                      color: state === "done" ? "#ffffff" : state === "current" ? "var(--deck-accent)" : "var(--deck-ink-soft)",
                    }}
                  >
                    {state === "done" ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => (i <= slide || showComplete) && goToSlide(i)}
                    disabled={i > slide && !showComplete}
                    className="pt-0.5 text-left text-sm leading-tight disabled:cursor-not-allowed"
                    style={{
                      color: state === "current" ? "var(--deck-ink)" : "var(--deck-ink-soft)",
                      fontWeight: state === "current" ? 600 : 400,
                    }}
                  >
                    {title}
                  </button>
                </li>
              );
            })}
            <li className="flex gap-3">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]"
                style={{
                  borderColor: showComplete ? "var(--deck-success)" : "var(--deck-border)",
                  backgroundColor: showComplete ? "var(--deck-success)" : "var(--deck-surface)",
                  color: showComplete ? "#ffffff" : "var(--deck-ink-soft)",
                }}
              >
                {showComplete ? <Check className="size-3.5" /> : "◆"}
              </span>
              <span
                className="pt-0.5 text-sm"
                style={{ color: showComplete ? "var(--deck-success)" : "var(--deck-ink-soft)", fontWeight: showComplete ? 600 : 400 }}
              >
                Complete
              </span>
            </li>
          </ol>

          {/* Slide surface */}
          <div
            className="overflow-hidden rounded-xl border"
            style={{ backgroundColor: "var(--deck-surface)", borderColor: "var(--deck-border)" }}
          >
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={showComplete ? "complete" : slide}
                custom={direction}
                variants={slideVariants}
                initial={prefersReducedMotion ? false : "enter"}
                animate="center"
                exit={prefersReducedMotion ? undefined : "exit"}
                transition={prefersReducedMotion ? { duration: 0 } : { type: "tween", duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                drag={!showComplete && !completing ? "x" : false}
                dragElastic={0.12}
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_event, info) => {
                  if (info.offset.x < -80 || info.velocity.x < -400) goNext();
                  else if (info.offset.x > 80 || info.velocity.x > 400) goPrev();
                }}
                className="p-6 sm:p-8"
              >
                {showComplete ? (
                  <CompletionSlide
                    lessonTitle={lessonTitle}
                    quizHref={quizHref}
                    backHref={backHref}
                    backLabel={backLabel}
                    nextLessonHref={nextLessonHref}
                    nextLessonTitle={nextLessonTitle}
                  />
                ) : isTitleSlide ? (
                  <TitleSlide
                    lessonTitle={lessonTitle}
                    moduleTitle={moduleTitle}
                    stageTitle={stageTitle}
                    jurisdiction={jurisdiction}
                  />
                ) : isQuizBridgeSlide ? (
                  <QuizBridgeSlide quizMeta={quizMeta} quizHref={quizHref} />
                ) : (
                  <StepSlide
                    step={currentStep!}
                    flavorMeta={flavorMeta}
                    showSignOff={realStepIndex === totalSteps - 1 && requiresSignOff && !!onSubmitSignOff}
                    signOff={signOff}
                    onSubmitSignOff={onSubmitSignOff}
                  />
                )}

                {!showComplete && blocked && (
                  <p
                    className="mt-6 rounded-md border border-dashed px-3 py-2 text-sm"
                    style={{ borderColor: "var(--deck-warning)", color: "#92400e" }}
                  >
                    {blockedReason === "signoff_required"
                      ? "You need to add your sign-off above before this lesson can be marked complete."
                      : blockedReason === "stage_locked"
                        ? "This stage isn't unlocked for you yet."
                        : (
                          <>
                            You need to pass the knowledge check before this lesson can be marked complete.
                            {quizHref && (
                              <>
                                {" "}
                                <Link href={quizHref} className="underline">
                                  Take the knowledge check
                                </Link>
                              </>
                            )}
                          </>
                        )}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {!showComplete && (
              <div
                className="flex items-center justify-between border-t px-6 py-4 sm:px-8"
                style={{ borderColor: "var(--deck-border)" }}
              >
                <Button type="button" variant="ghost" onClick={goPrev} disabled={slide === 0}>
                  <ArrowLeft /> Back
                </Button>
                <Button type="button" onClick={goNext} disabled={completing}>
                  {completing ? "Completing…" : slide === lastSlideIndex ? "Complete Lesson" : "Next"}
                  {!completing && <ArrowRight />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {resources && resources.length > 0 && (
          <div className="mt-8 rounded-xl border p-5 sm:p-6" style={{ borderColor: "var(--deck-border)" }}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Lesson resources</p>
            <ul className="mt-3 grid gap-2">
              {resources.map((resource) => (
                <li key={resource.id}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-black/[0.02]"
                    style={{ borderColor: "var(--deck-border)", color: "var(--deck-ink)" }}
                  >
                    <FileText className="size-4 shrink-0" style={{ color: "var(--deck-accent)" }} />
                    <span className="flex-1">
                      {resource.title} <span style={{ color: "var(--deck-ink-soft)" }}>· {resource.fileType}</span>
                    </span>
                    <ExternalLink className="size-3.5 shrink-0" style={{ color: "var(--deck-ink-soft)" }} />
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

function DraftPreviewBanner() {
  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
      style={{ borderColor: "var(--deck-warning)", color: "#92400e" }}
    >
      <Eye className="size-4 shrink-0" />
      You&apos;re previewing this as staff — it&apos;s not published, so trainees can&apos;t see it yet.
    </div>
  );
}

function TitleSlide({
  lessonTitle,
  moduleTitle,
  stageTitle,
  jurisdiction,
}: {
  lessonTitle: string;
  moduleTitle: string;
  stageTitle: string | null;
  jurisdiction: TrainingJurisdiction | null;
}) {
  const focusTarget = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--deck-accent-soft)", color: "var(--deck-accent)" }}
      >
        <GraduationCap className="size-7" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <JurisdictionBadge jurisdiction={jurisdiction} />
        {stageTitle && <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stageTitle}</span>}
      </div>
      <p className="text-sm font-medium text-muted-foreground">{moduleTitle}</p>
      <h2 ref={focusTarget} tabIndex={-1} className="max-w-lg text-3xl font-semibold text-balance outline-none" style={{ color: "var(--deck-ink)" }}>
        {lessonTitle}
      </h2>
    </div>
  );
}

function QuizBridgeSlide({
  quizMeta,
  quizHref,
}: {
  quizMeta?: QuizMeta;
  quizHref?: string;
}) {
  const focusTarget = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--deck-accent-soft)", color: "var(--deck-accent)" }}
      >
        <ClipboardCheck className="size-7" />
      </div>
      <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--deck-accent)" }}>
        Knowledge Check
      </p>
      <h2 ref={focusTarget} tabIndex={-1} className="text-2xl font-semibold outline-none" style={{ color: "var(--deck-ink)" }}>
        {quizMeta?.title ?? "Let's check your understanding"}
      </h2>
      {quizMeta && (
        <p className="text-sm text-muted-foreground">
          {quizMeta.questionCount} {quizMeta.questionCount === 1 ? "question" : "questions"} · Pass mark {quizMeta.passingScore}%
        </p>
      )}
      {quizHref && (
        <Button nativeButton={false} render={<Link href={quizHref} />} className="mt-2">
          Start Knowledge Check
        </Button>
      )}
    </div>
  );
}

function CompletionSlide({
  lessonTitle,
  quizHref,
  backHref,
  backLabel,
  nextLessonHref,
  nextLessonTitle,
}: {
  lessonTitle: string;
  quizHref?: string;
  backHref: string;
  backLabel: string;
  nextLessonHref: string | null;
  nextLessonTitle: string | null;
}) {
  const focusTarget = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div
        className="deck-complete-badge flex size-20 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--deck-success-soft)", color: "var(--deck-success)" }}
      >
        <Check className="size-9" />
      </div>
      <p className="mt-4 text-xs font-medium tracking-wide uppercase" style={{ color: "var(--deck-success)" }}>
        Lesson Complete
      </p>
      <h2 ref={focusTarget} tabIndex={-1} className="mt-1 text-2xl font-semibold outline-none" style={{ color: "var(--deck-ink)" }}>
        {lessonTitle}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        You&apos;ve completed every slide in this lesson. It&apos;s now marked complete on your record.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {quizHref && (
          <Button variant="outline" nativeButton={false} render={<Link href={quizHref} />}>
            Take the knowledge check
          </Button>
        )}
        {nextLessonHref ? (
          <Button nativeButton={false} render={<Link href={nextLessonHref} />}>
            Continue to {nextLessonTitle ?? "next lesson"} <ArrowRight />
          </Button>
        ) : (
          <Button nativeButton={false} render={<Link href={backHref} />}>
            {backLabel}
          </Button>
        )}
      </div>
      {nextLessonHref && (
        <Link href={backHref} className="mt-3 text-sm text-muted-foreground hover:underline">
          Return to {backLabel}
        </Link>
      )}
    </div>
  );
}

function StepSlide({
  step,
  flavorMeta,
  showSignOff,
  signOff,
  onSubmitSignOff,
}: {
  step: Step;
  flavorMeta: (typeof FLAVOR_META)[SlideFlavor];
  showSignOff: boolean;
  signOff: SignOffState;
  onSubmitSignOff?: (state: SignOffActionResult, formData: FormData) => Promise<SignOffActionResult>;
}) {
  const focusTarget = useFocusOnMount<HTMLHeadingElement>();
  const contentRef = useRef<HTMLDivElement>(null);

  // Scratchpad answer boxes: under each numbered question in reflection/scenario/exercise
  // sections, so trainees can think out loud as they read. Not saved anywhere on purpose.
  // Mount-once (this component itself remounts fresh per slide, so `step` never changes
  // across the lifetime of one instance) — deliberately not tied to the outer viewer's
  // `slide` state, since AnimatePresence's mode="wait" defers the real DOM commit for an
  // incoming slide and an outer-state-driven effect can fire before the container exists.
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !/reflection|practical scenario|practical exercise/i.test(step.title)) return;

    const paragraphs = Array.from(container.querySelectorAll(":scope > p"));
    const inserted: HTMLElement[] = [];
    for (const p of paragraphs) {
      const text = p.textContent?.trim() ?? "";
      if (!/^\d+[.)]\s*\S/.test(text)) continue;

      const wrapper = document.createElement("div");
      wrapper.className = "deck-scratch-answer mt-2 mb-4";
      wrapper.style.cssText = "margin-top: 0.5rem; margin-bottom: 1rem;";

      const label = document.createElement("label");
      label.textContent = "Jot your answer";
      label.style.cssText =
        "display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem; color: var(--deck-ink-soft);";

      const textarea = document.createElement("textarea");
      textarea.rows = 3;
      textarea.placeholder = "Type your thinking here — this is just for you, it isn't saved.";
      textarea.style.cssText =
        "width: 100%; border-radius: 0.5rem; border: 1px solid var(--deck-border); background: var(--deck-surface-sunken); padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--deck-ink); resize: vertical;";

      wrapper.appendChild(label);
      wrapper.appendChild(textarea);
      p.insertAdjacentElement("afterend", wrapper);
      inserted.push(wrapper);
    }

    return () => {
      for (const el of inserted) el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase" style={{ color: flavorMeta.accent }}>
        <flavorMeta.icon className="size-3.5" />
        {flavorMeta.label}
      </p>
      <h2 ref={focusTarget} tabIndex={-1} className="mt-1 text-2xl font-semibold outline-none" style={{ color: "var(--deck-ink)" }}>
        {step.title}
      </h2>
      {/* The step's own HTML starts with the same H2 heading already shown above as
          the slide title (see split-into-steps.ts) — hidden here via CSS so it isn't
          printed twice, without altering the stored content or the shared HTML renderer. */}
      <div ref={contentRef} className="lesson-content lesson-slide-body mt-4" dangerouslySetInnerHTML={{ __html: step.html }} />

      {showSignOff && onSubmitSignOff && <SignOffPanel signOff={signOff} action={onSubmitSignOff} />}
    </>
  );
}
