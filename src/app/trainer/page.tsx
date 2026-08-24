import Link from "next/link";
import { AlertTriangle, Award, ClipboardCheck, Users } from "lucide-react";
import { auth } from "@/auth";
import { getTraineeOverviews } from "@/lib/trainee-overview";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default async function TrainerDashboardPage() {
  const session = await auth();
  const actor = { id: session!.user.id, role: session!.user.role };
  const trainees = await getTraineeOverviews(actor);

  const behind = trainees.filter((t) => t.isBehind);
  const awaitingSignOff = trainees.filter((t) => t.awaitingSignOff.length > 0);
  const pendingCertificates = trainees.reduce((n, t) => n + t.certificatesPending, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Trainer dashboard"
        description="The trainees assigned to you, and what needs you next."
      />

      {trainees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No trainees assigned to you yet"
          description="An administrator assigns trainees to you from the Trainees page. Once they do, their progress and anything waiting on your sign-off appears here."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Your trainees" value={trainees.length} icon={Users} />
            <StatCard
              label="Awaiting your sign-off"
              value={awaitingSignOff.length}
              icon={ClipboardCheck}
              tone={awaitingSignOff.length > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Certificates to review"
              value={pendingCertificates}
              icon={Award}
              tone={pendingCertificates > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Falling behind"
              value={behind.length}
              icon={AlertTriangle}
              tone={behind.length > 0 ? "warning" : "success"}
            />
          </div>

          {awaitingSignOff.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Waiting on you</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {awaitingSignOff.map((trainee) => (
                  <div
                    key={trainee.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{trainee.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {trainee.awaitingSignOff.map((s) => s.stageTitle).join(", ")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/trainer/trainees/${trainee.id}`} />}
                    >
                      Review
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Your trainees</CardTitle>
              <Link
                href="/trainer/trainees"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="grid gap-3">
              {trainees.slice(0, 6).map((trainee) => (
                <div key={trainee.id} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/trainer/trainees/${trainee.id}`}
                      className="min-w-0 truncate font-medium hover:underline"
                    >
                      {trainee.name}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      {trainee.isBehind && <Badge variant="destructive">Behind</Badge>}
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {trainee.progressPercent}%
                      </span>
                    </div>
                  </div>
                  <Progress value={trainee.progressPercent} />
                  <p className="text-xs text-muted-foreground">
                    {trainee.completedLessons} of {trainee.totalLessons} lessons ·{" "}
                    {trainee.enrolledCourses} course{trainee.enrolledCourses === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
