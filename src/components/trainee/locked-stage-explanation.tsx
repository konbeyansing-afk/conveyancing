import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { StageJourneyStatus } from "@/lib/stage-access";

export function LockedStageExplanation({
  stage,
  prerequisiteStage,
}: {
  stage: StageJourneyStatus;
  prerequisiteStage: StageJourneyStatus | null;
}) {
  return (
    <div className="mx-auto grid max-w-lg gap-6 py-10 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
        <Lock className="size-7 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="grid gap-1.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Stage {stage.order + 1}
        </p>
        <h1 className="text-2xl font-semibold">{stage.title}</h1>
        <p className="text-muted-foreground">This stage is currently locked.</p>
      </div>

      {prerequisiteStage ? (
        <div className="grid gap-4 rounded-xl border bg-card p-5 text-left">
          <div>
            <p className="text-sm font-medium">To unlock this stage:</p>
            <p className="text-sm text-muted-foreground">
              Complete Stage {prerequisiteStage.order + 1} — {prerequisiteStage.title}
            </p>
          </div>

          {prerequisiteStage.requireAllLessons && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Lessons</span>
                <span className="font-semibold tabular-nums">
                  {prerequisiteStage.completedLessons} / {prerequisiteStage.totalLessons} completed
                </span>
              </div>
              <Progress value={prerequisiteStage.progressPercent} />
            </div>
          )}
          {prerequisiteStage.requireQuizPass && (
            <p className="text-xs text-muted-foreground">
              Also requires passing that stage&apos;s assessment.
            </p>
          )}
          {prerequisiteStage.requireTrainerApproval && (
            <p className="text-xs text-muted-foreground">Also requires trainer approval.</p>
          )}

          <Button nativeButton={false} render={<Link href={`/app/journey/${prerequisiteStage.id}`} />}>
            Continue Stage {prerequisiteStage.order + 1}
            <ArrowRight />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This stage doesn&apos;t have any content published yet — check back soon.
        </p>
      )}
    </div>
  );
}
