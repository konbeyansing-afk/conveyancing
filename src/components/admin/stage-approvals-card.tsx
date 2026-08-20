import { Trash2, ShieldCheck, UserCheck } from "lucide-react";
import { approveStageForTrainee, revokeStageApproval } from "@/lib/actions/stages";
import { FormDialog } from "@/components/admin/form-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export type StageApprovalRecord = {
  approvalId: string;
  userId: string;
  name: string;
  email: string;
  approvedAt: string;
  approvedByName: string;
};
export type EligibleTrainee = { id: string; name: string; email: string };

export function StageApprovalsCard({
  programId,
  stageId,
  approvals,
  eligibleTrainees,
}: {
  programId: string;
  stageId: string;
  approvals: StageApprovalRecord[];
  eligibleTrainees: EligibleTrainee[];
}) {
  const approveAction = approveStageForTrainee.bind(null, programId, stageId);
  const approvedUserIds = new Set(approvals.map((a) => a.userId));
  const available = eligibleTrainees.filter((t) => !approvedUserIds.has(t.id));

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Trainer Approvals
          <Badge variant="secondary">{approvals.length}</Badge>
        </CardTitle>
        <FormDialog
          trigger={
            <>
              <UserCheck /> Approve trainee
            </>
          }
          triggerSize="sm"
          title="Approve a trainee for this stage"
          description="This marks the stage complete for them, unlocking the next stage."
          action={approveAction}
          submitLabel="Approve"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="approve-stage-userId">Trainee</Label>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trainees available to approve.</p>
            ) : (
              <select
                id="approve-stage-userId"
                name="userId"
                required
                autoFocus
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {available.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.email})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approve-stage-notes">Notes (optional)</Label>
            <Input id="approve-stage-notes" name="notes" placeholder="e.g. Observed 3 matter openings" />
          </div>
        </FormDialog>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No approvals yet"
            description="Approve a trainee here once they've met this stage's requirements in person."
          />
        ) : (
          <div className="grid">
            {approvals.map((a) => {
              const revokeAction = revokeStageApproval.bind(null, programId, a.approvalId);
              return (
                <div
                  key={a.approvalId}
                  className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{initials(a.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Approved {formatRelativeTime(new Date(a.approvedAt))} by {a.approvedByName}
                  </span>
                  <DeleteConfirmDialog
                    trigger={<Trash2 className="size-4" />}
                    title={`Revoke approval for ${a.name}?`}
                    description="They will lose access to the next stage until re-approved."
                    action={revokeAction}
                    confirmLabel="Revoke"
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
