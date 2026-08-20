import { StageCard } from "@/components/trainee/stage-card";
import type { StageJourneyStatus } from "@/lib/stage-access";

export function StageTimeline({ stages }: { stages: StageJourneyStatus[] }) {
  return (
    <div className="grid">
      {stages.map((stage, i) => (
        <div key={stage.id} className="relative pb-4 last:pb-0">
          {i < stages.length - 1 && (
            <span
              className="absolute top-[calc(100%-1rem)] left-1/2 h-4 w-px -translate-x-1/2 bg-border"
              aria-hidden
            />
          )}
          <StageCard stage={stage} />
        </div>
      ))}
    </div>
  );
}
