import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { StageJourneyStatus } from "@/lib/stage-access";

export function JourneySummaryCard({
  programTitle,
  stages,
  continueHref,
  showViewAll = true,
}: {
  programTitle: string;
  stages: StageJourneyStatus[];
  continueHref: string | null;
  showViewAll?: boolean;
}) {
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const totalStages = stages.length;
  const overallPercent = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : 0;
  const currentStage = stages.find((s) => s.status === "current");

  return (
    <Card>
      <CardContent className="grid gap-5 py-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Your Training Journey
          </p>
          <h2 className="font-heading text-lg font-semibold">{programTitle}</h2>
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">
              {completedCount} of {totalStages} stages completed
            </span>
            <span className="font-semibold text-primary">{overallPercent}%</span>
          </div>
          <Progress value={overallPercent} />
        </div>

        {currentStage ? (
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Current Stage — Stage {currentStage.order + 1}
              </p>
              <p className="font-medium">{currentStage.title}</p>
              <p className="text-xs text-muted-foreground">
                {currentStage.totalLessons > 0
                  ? `${currentStage.completedLessons} of ${currentStage.totalLessons} lessons completed`
                  : "Content coming soon"}
              </p>
            </div>
            {continueHref && (
              <Button className="w-fit" nativeButton={false} render={<Link href={continueHref} />}>
                Continue Learning
                <ArrowRight />
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {completedCount === totalStages
              ? "You've completed every stage — nice work."
              : "Your current stage will show up here once you're enrolled."}
          </p>
        )}

        {showViewAll && (
          <Link href="/app/journey" className="text-sm font-medium text-primary hover:underline">
            View full training journey →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
