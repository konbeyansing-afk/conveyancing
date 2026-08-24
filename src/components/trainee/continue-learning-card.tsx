import Link from "next/link";
import { ArrowRight, ClipboardCheck, PartyPopper, Trophy } from "lucide-react";
import type { CertificateStatus } from "@prisma/client";
import type { ContinueLearningTarget, UpcomingAssessment } from "@/lib/stage-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Answers "what am I currently learning?" and "what should I do next?" in one
 * place, at lesson granularity — the piece the rest of the dashboard's
 * stage-level summary doesn't cover. Every field here comes straight off
 * getContinueLearningInfo; there is no state this component invents.
 */
export function ContinueLearningCard({
  stageTitle,
  stageHasPublishedLessons,
  target,
  upcomingAssessment,
  allStagesComplete,
  certificateStatus,
}: {
  stageTitle: string | null;
  /** Whether the current stage has published lessons at all, independent of enrolment. */
  stageHasPublishedLessons: boolean;
  target: ContinueLearningTarget | null;
  upcomingAssessment: UpcomingAssessment | null;
  allStagesComplete: boolean;
  certificateStatus: CertificateStatus | null;
}) {
  if (allStagesComplete) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
              <PartyPopper className="size-5" />
            </div>
            <div>
              <p className="font-medium">You&apos;ve completed every stage</p>
              <p className="text-sm text-muted-foreground">
                {certificateStatus === "ISSUED"
                  ? "Your certificate has been issued."
                  : certificateStatus === "PENDING_APPROVAL"
                    ? "Your certificate is waiting on a trainer's sign-off."
                    : "Nice work."}
              </p>
            </div>
          </div>
          {certificateStatus && (
            <Button variant="outline" nativeButton={false} render={<Link href="/app/certificates" />}>
              <Trophy className="size-4" />
              View certificate
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!target) {
    // Two genuinely different reasons a trainee can have nothing to continue:
    // the stage simply has no published content yet, or it does but nobody
    // has enrolled them in its course. Telling them apart matters — the first
    // is "check back later", the second is "ask your trainer".
    const message = !stageTitle
      ? "Your next lesson will show up here once you're enrolled in a course."
      : stageHasPublishedLessons
        ? "You've unlocked this stage, but you're not enrolled in its course yet. Ask your trainer or admin to enrol you."
        : "This stage doesn't have any lessons published yet — check back soon.";

    return (
      <Card>
        <CardContent className="py-5">
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="grid gap-4 py-5">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Continue Learning</p>

        <div className="grid gap-2.5 sm:grid-cols-3">
          {stageTitle && (
            <div>
              <p className="text-xs text-muted-foreground">Current Stage</p>
              <p className="truncate font-medium">{stageTitle}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Current Course</p>
            <p className="truncate font-medium">{target.course.title}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Lesson</p>
            <p className="truncate font-medium">{target.lesson.title}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button nativeButton={false} render={<Link href={target.href} />} className="w-fit">
            Continue Learning
            <ArrowRight />
          </Button>

          {upcomingAssessment && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ClipboardCheck className="size-4 shrink-0" />
              Assessment coming up: <span className="font-medium">{upcomingAssessment.quizTitle}</span>{" "}
              ({upcomingAssessment.lessonTitle})
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
