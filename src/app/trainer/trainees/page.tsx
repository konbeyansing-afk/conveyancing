import Link from "next/link";
import { Users } from "lucide-react";
import { auth } from "@/auth";
import { getTraineeOverviews } from "@/lib/trainee-overview";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

function formatWhen(date: Date | null) {
  if (!date) return "No activity yet";
  return `Last active ${date.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
}

export default async function TrainerTraineesPage() {
  const session = await auth();
  const actor = { id: session!.user.id, role: session!.user.role };
  const trainees = await getTraineeOverviews(actor);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Your trainees"
        description="Progress, sign-offs and anyone who has stalled."
      />

      {trainees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No trainees assigned to you yet"
          description="An administrator assigns trainees to you from the admin Trainees page."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-2.5 font-medium">Trainee</th>
                <th className="px-4 py-2.5 font-medium">Progress</th>
                <th className="px-4 py-2.5 font-medium">Courses</th>
                <th className="px-4 py-2.5 font-medium">Needs you</th>
                <th className="px-4 py-2.5 font-medium">Activity</th>
              </tr>
            </thead>
            <tbody>
              {trainees.map((trainee) => (
                <tr key={trainee.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/trainer/trainees/${trainee.id}`}
                      className="font-medium hover:underline"
                    >
                      {trainee.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{trainee.email}</p>
                  </td>
                  <td className="w-48 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={trainee.progressPercent} className="flex-1" />
                      <span className="shrink-0 tabular-nums">{trainee.progressPercent}%</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {trainee.completedLessons}/{trainee.totalLessons} lessons
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{trainee.enrolledCourses}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {trainee.awaitingSignOff.length > 0 && (
                        <Badge variant="secondary">
                          {trainee.awaitingSignOff.length} sign-off
                          {trainee.awaitingSignOff.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {trainee.certificatesPending > 0 && (
                        <Badge variant="secondary">{trainee.certificatesPending} certificate</Badge>
                      )}
                      {trainee.awaitingSignOff.length === 0 &&
                        trainee.certificatesPending === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {trainee.isBehind && <Badge variant="destructive">Behind</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {formatWhen(trainee.lastActivityAt)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
