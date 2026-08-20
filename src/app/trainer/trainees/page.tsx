import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function TrainerTraineesPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Trainees</h1>
        <p className="text-muted-foreground">
          Review progress, quiz attempts, and provide feedback.
        </p>
      </div>
      <EmptyState
        icon={Users}
        title="Trainee list coming soon"
        description="This is where you'll see everyone enrolled in your courses. Planned for the trainer dashboard phase."
      />
    </div>
  );
}
