import { auth } from "@/auth";
import {
  getJourneyForUser,
  getNextLessonHrefForStage,
  getPrimaryProgramForUser,
} from "@/lib/stage-access";
import { StageTimeline } from "@/components/trainee/stage-timeline";
import { JourneySummaryCard } from "@/components/trainee/journey-summary-card";
import { EmptyState } from "@/components/empty-state";
import { Route } from "lucide-react";

export default async function TrainingJourneyPage() {
  const session = await auth();
  const userId = session!.user.id;

  const program = await getPrimaryProgramForUser(userId);

  if (!program) {
    return (
      <EmptyState
        icon={Route}
        title="No training journey yet"
        description="Your guided training pathway will appear here once it's been set up."
      />
    );
  }

  const stages = await getJourneyForUser(program.id, userId);
  const currentStage = stages.find((s) => s.status === "current");
  const continueHref = currentStage ? await getNextLessonHrefForStage(currentStage.id, userId) : null;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-balance">Training Journey</h1>
        <p className="text-muted-foreground">
          Your complete guided path — from new hire to production-ready, one stage at a time.
        </p>
      </div>

      <JourneySummaryCard
        programTitle={program.title}
        stages={stages}
        continueHref={continueHref}
        showViewAll={false}
      />

      <StageTimeline stages={stages} />
    </div>
  );
}
