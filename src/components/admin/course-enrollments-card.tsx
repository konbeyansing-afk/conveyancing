import { Trash2, UserPlus, Users } from "lucide-react";
import { enrollTrainee, unenrollTrainee } from "@/lib/actions/enrollments";
import { FormDialog } from "@/components/admin/form-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatRelativeTime } from "@/lib/format-relative-time";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export type EnrolledTrainee = {
  enrollmentId: string;
  name: string;
  email: string;
  status: "ACTIVE" | "COMPLETED";
  enrolledAt: string;
};

export type AvailableTrainee = { id: string; name: string; email: string };

export function CourseEnrollmentsCard({
  programId,
  courseId,
  enrolled,
  available,
}: {
  programId: string;
  courseId: string;
  enrolled: EnrolledTrainee[];
  available: AvailableTrainee[];
}) {
  const enrollAction = enrollTrainee.bind(null, programId, courseId);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          Enrolled Trainees
          <Badge variant="secondary">{enrolled.length}</Badge>
        </CardTitle>
        <FormDialog
          trigger={
            <>
              <UserPlus /> Enroll trainee
            </>
          }
          triggerSize="sm"
          title="Enroll a trainee"
          description="Only enrolled trainees can see this course in My Courses, or open it directly."
          action={enrollAction}
          submitLabel="Enroll"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="enroll-trainee-userId">Trainee</Label>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every trainee account is already enrolled in this course.
              </p>
            ) : (
              <select
                id="enroll-trainee-userId"
                name="userId"
                required
                autoFocus
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {available.map((trainee) => (
                  <option key={trainee.id} value={trainee.id}>
                    {trainee.name} ({trainee.email})
                  </option>
                ))}
              </select>
            )}
          </div>
        </FormDialog>
      </CardHeader>
      <CardContent>
        {enrolled.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No trainees enrolled yet"
            description="Published courses are only visible to trainees you enroll here — publishing alone doesn't grant access."
          />
        ) : (
          <div className="grid">
            {enrolled.map((trainee) => {
              const unenrollAction = unenrollTrainee.bind(
                null,
                programId,
                courseId,
                trainee.enrollmentId
              );
              return (
                <div
                  key={trainee.enrollmentId}
                  className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{initials(trainee.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{trainee.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{trainee.email}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      trainee.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    {trainee.status === "COMPLETED" ? "Completed" : "Active"}
                  </Badge>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Enrolled {formatRelativeTime(new Date(trainee.enrolledAt))}
                  </span>
                  <DeleteConfirmDialog
                    trigger={<Trash2 className="size-4" />}
                    title={`Remove ${trainee.name} from this course?`}
                    description="They lose access to this course and its lessons immediately. Their lesson progress is kept in case you re-enroll them."
                    action={unenrollAction}
                    confirmLabel="Remove"
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
