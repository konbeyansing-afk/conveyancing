import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

/**
 * Answers "how much have I completed?", "what have I already completed?" and
 * "what is locked?" — lesson-level totals summed from the trainee's real
 * per-stage progress, not a separate estimate.
 */
export function ProgramProgressCard({
  completedLessons,
  totalLessons,
  nextMilestone,
  lockedStageCount,
}: {
  completedLessons: number;
  totalLessons: number;
  nextMilestone: string | null;
  lockedStageCount: number;
}) {
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const remaining = Math.max(totalLessons - completedLessons, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Program Progress</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Lessons completed</span>
            <span className="font-semibold text-primary">{percent}%</span>
          </div>
          <Progress value={percent} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Completed</dt>
            <dd className="font-medium">
              {completedLessons} lesson{completedLessons === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining</dt>
            <dd className="font-medium">
              {remaining} lesson{remaining === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>

        {nextMilestone && (
          <div>
            <p className="text-xs text-muted-foreground">Next milestone</p>
            <p className="font-medium">{nextMilestone}</p>
          </div>
        )}

        {lockedStageCount > 0 && (
          <Link
            href="/app/journey"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <Lock className="size-3.5 shrink-0" />
            {lockedStageCount} stage{lockedStageCount === 1 ? "" : "s"} still locked — view journey
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
