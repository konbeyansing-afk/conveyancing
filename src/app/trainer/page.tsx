import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function TrainerDashboardPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Trainer dashboard</h1>
        <p className="text-muted-foreground">
          Monitor trainee progress and review assessments.
        </p>
      </div>
      <EmptyState
        icon={Users}
        title="No trainees assigned yet"
        description="Trainee progress monitoring is coming in a later phase, once courses and enrollments exist."
      />
    </div>
  );
}
