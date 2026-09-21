import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { TrainingJurisdiction } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { JurisdictionBadge } from "@/components/lesson-content/lesson-intro-screen";

/**
 * The dashboard's first screen: where am I, what's next, how am I doing.
 * Every value is passed in from the page's existing queries — nothing here
 * derives or invents progress of its own.
 */
export function DashboardHero({
  firstName,
  programTitle,
  jurisdiction,
  stageNumber,
  stageTitle,
  lessonTitle,
  continueHref,
  percent,
  completedLessons,
  totalLessons,
}: {
  firstName: string;
  programTitle: string | null;
  jurisdiction: TrainingJurisdiction | null | undefined;
  stageNumber: number | null;
  stageTitle: string | null;
  lessonTitle: string | null;
  continueHref: string | null;
  percent: number;
  completedLessons: number;
  totalLessons: number;
}) {
  return (
    <section
      aria-label="Your training"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-slate)] via-[#13224a] to-[#1d3a8a] p-6 text-white shadow-(--shadow-raised) sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <JurisdictionBadge jurisdiction={jurisdiction} />
            {programTitle && <span className="text-xs font-medium tracking-wide text-white/60 uppercase">{programTitle}</span>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Welcome back, {firstName}.</h1>
          {stageTitle ? (
            <p className="max-w-xl text-white/75">
              You&apos;re in <span className="font-medium text-white">Stage {stageNumber}: {stageTitle}</span>
              {lessonTitle && (
                <>
                  . Up next: <span className="font-medium text-white">{lessonTitle}</span>
                </>
              )}
              .
            </p>
          ) : (
            <p className="max-w-xl text-white/75">Track your training, continue your lessons, and monitor your progress.</p>
          )}
          {continueHref && (
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href={continueHref} />}
              className="mt-1 h-10 w-fit bg-white px-4 text-[var(--brand-slate)] hover:bg-white/90"
            >
              Continue training
              <ArrowRight />
            </Button>
          )}
        </div>

        {totalLessons > 0 && (
          <div className="grid w-full gap-2 rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/10 lg:w-64">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium tracking-wide text-white/60 uppercase">Lessons completed</span>
              <span className="text-2xl font-semibold tabular-nums">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Lessons completed"
              className="h-1.5 overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs text-white/60 tabular-nums">
              {completedLessons} of {totalLessons} lessons
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
