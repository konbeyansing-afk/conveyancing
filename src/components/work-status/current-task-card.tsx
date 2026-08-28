import { CheckCircle2, ClipboardList, Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/work-status/status-badge";
import { PriorityBadge } from "@/components/work-status/priority-badge";
import { MatterStageBadge } from "@/components/work-status/matter-stage-badge";
import { JurisdictionBadge } from "@/components/work-status/jurisdiction-badge";
import { ConveyancingTimeline } from "@/components/work-status/conveyancing-timeline";
import { UpdateWorkStatusDialog, type EditableWorkItem } from "@/components/work-status/update-status-dialog";
import {
  AddNoteDialog,
  MarkBlockedDialog,
  QuickStatusButton,
  ResumeWorkDialog,
} from "@/components/work-status/quick-actions";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { nextMatterStageLabel } from "@/lib/matter-stage";
import type { MatterStage } from "@prisma/client";

const timeFormat = (d: Date) =>
  d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });

export type CurrentTaskItem = EditableWorkItem & {
  matterStage: MatterStage;
  startedAt: Date | null;
  updatedAt: Date;
};

/**
 * The hierarchy here is deliberate (spec): Matter Stage — "where is the
 * transaction?" — is the most prominent element, ahead of Work Status
 * ("what is the work doing?") and Current Task ("what is the VA actually
 * doing?"). They are three separate answers, never collapsed into one
 * generic status.
 */
export function CurrentTaskCard({ item }: { item: CurrentTaskItem | null }) {
  if (!item) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nothing marked in progress"
        description="Use “+ Update Work Status” below to tell Admin what you're working on."
      />
    );
  }

  const isBlocked = item.status === "BLOCKED";
  const next = nextMatterStageLabel(item.jurisdiction, item.matterStage);

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Currently Working On
        </p>
        <JurisdictionBadge jurisdiction={item.jurisdiction} />
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <MatterStageBadge stage={item.matterStage} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {item.matterReference && <span>Matter #{item.matterReference}</span>}
            {item.clientReference && <span>Client: {item.clientReference}</span>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">Current Task</p>
            <p className="text-lg font-semibold text-balance">{item.title}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">Work Status</p>
            <div className="mt-1">
              <StatusBadge status={item.status} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={item.priority} />
          {item.startedAt && (
            <span className="text-xs text-muted-foreground">Started {timeFormat(item.startedAt)}</span>
          )}
          <span className="text-xs text-muted-foreground">
            Last updated {formatRelativeTime(item.updatedAt)}
          </span>
        </div>

        {item.notes && (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">{item.notes}</p>
        )}

        {isBlocked && (
          <div className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <p className="font-medium text-destructive">Blocked / Needs Attention</p>
            {item.blockedReason && (
              <p>
                <span className="text-muted-foreground">Reason: </span>
                {item.blockedReason}
              </p>
            )}
            {item.blockedNeeds && (
              <p>
                <span className="text-muted-foreground">Needs: </span>
                {item.blockedNeeds}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Conveyancing Timeline</p>
          <ConveyancingTimeline
            jurisdiction={item.jurisdiction}
            currentStage={item.matterStage}
            isWorkBlocked={isBlocked}
          />
          {next && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Next Matter Stage:</span> {next}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UpdateWorkStatusDialog item={item} trigger="Update" triggerClassName="h-7 px-2.5 text-[0.8rem]" />
          {isBlocked ? (
            <ResumeWorkDialog
              workItemId={item.id}
              triggerLabel="Resolve Blocker"
              dialogTitle="Resolve blocker"
              notePlaceholder="What changed?"
            />
          ) : (
            <>
              <QuickStatusButton
                workItemId={item.id}
                newStatus="COMPLETED"
                label="Mark Completed"
                icon={<CheckCircle2 className="size-3.5" />}
              />
              <QuickStatusButton
                workItemId={item.id}
                newStatus="WAITING_PENDING"
                label="Mark Pending"
                icon={<Hourglass className="size-3.5" />}
              />
              <MarkBlockedDialog workItemId={item.id} />
            </>
          )}
          <AddNoteDialog workItemId={item.id} />
        </div>
      </CardContent>
    </Card>
  );
}
