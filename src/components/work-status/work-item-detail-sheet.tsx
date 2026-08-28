"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, StickyNote } from "lucide-react";
import { addAdminNote, updateMatterStage } from "@/lib/actions/work-status";
import { WORK_STATUS_LABELS } from "@/lib/work-status";
import {
  JURISDICTION_LABELS,
  MATTER_STAGE_LABELS,
  MATTER_TYPE_LABELS,
  matterWorkflow,
  nextMatterStageLabel,
} from "@/lib/matter-stage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/work-status/status-badge";
import { PriorityBadge } from "@/components/work-status/priority-badge";
import { MatterStageBadge } from "@/components/work-status/matter-stage-badge";
import { JurisdictionBadge } from "@/components/work-status/jurisdiction-badge";
import { ConveyancingTimeline } from "@/components/work-status/conveyancing-timeline";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Jurisdiction, MatterStage, MatterType, WorkPriority, WorkStatus } from "@prisma/client";

const dateTimeFormat = (d: Date) =>
  d.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export type WorkItemDetail = {
  id: string;
  title: string;
  matterReference: string | null;
  clientReference: string | null;
  jurisdiction: Jurisdiction;
  matterType: MatterType | null;
  matterStage: MatterStage;
  status: WorkStatus;
  priority: WorkPriority;
  notes: string | null;
  blockedReason: string | null;
  blockedNeeds: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedCompletion: Date | null;
  createdAt: Date;
  updatedAt: Date;
  vaName?: string;
  activity: {
    id: string;
    previousStatus: WorkStatus | null;
    newStatus: WorkStatus;
    previousMatterStage: MatterStage | null;
    newMatterStage: MatterStage | null;
    note: string | null;
    createdAt: Date;
    user: { name: string };
  }[];
  adminNotes: { id: string; note: string; createdAt: Date; adminUser: { name: string } }[];
};

/**
 * Matter Stage is the one field on a WorkItem the VA cannot edit — only an
 * Admin or an authorized Trainer moves a matter through its conveyancing
 * lifecycle. Options are scoped to the matter's own jurisdiction workflow,
 * so an NSW matter is never offered a QLD-only stage.
 */
function MatterStageEditor({ item }: { item: WorkItemDetail }) {
  const action = updateMatterStage.bind(null, item.id);
  const [stage, setStage] = useState<MatterStage>(item.matterStage);
  const [state, formAction, pending] = useActionState(action, null);
  const stages = matterWorkflow(item.jurisdiction);

  return (
    <form action={formAction} className="grid gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <label htmlFor={`matterStage-${item.id}`} className="text-xs font-medium text-muted-foreground">
            Matter Stage ({JURISDICTION_LABELS[item.jurisdiction]} workflow)
          </label>
          <select
            id={`matterStage-${item.id}`}
            name="newStage"
            value={stage}
            onChange={(e) => setStage(e.target.value as MatterStage)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {MATTER_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending || stage === item.matterStage}>
          {pending ? "Saving…" : "Update Stage"}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-xs text-success">
          {state.success}
        </p>
      )}
    </form>
  );
}

function AddAdminNoteForm({ workItemId }: { workItemId: string }) {
  const action = addAdminNote.bind(null, workItemId);
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-2">
      <Textarea name="note" rows={2} required placeholder="Add an internal note for this VA…" />
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Add Admin Note"}
      </Button>
    </form>
  );
}

export function WorkItemDetailSheet({
  item,
  canAddAdminNote = false,
  canEditMatterStage = false,
  trigger,
}: {
  item: WorkItemDetail;
  canAddAdminNote?: boolean;
  canEditMatterStage?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const timeline = [...item.activity].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const notes = [...item.adminNotes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const next = nextMatterStageLabel(item.jurisdiction, item.matterStage);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" size="sm" variant="outline" />}>
        {trigger ?? (
          <>
            <Eye className="size-3.5" />
            View
          </>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="pr-6">{item.title}</SheetTitle>
          <SheetDescription>
            {item.vaName ? `${item.vaName} · ` : ""}
            {item.matterReference ? `Matter #${item.matterReference}` : "No matter reference"}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <JurisdictionBadge jurisdiction={item.jurisdiction} />
            {item.matterType && <Badge variant="secondary">{MATTER_TYPE_LABELS[item.matterType]}</Badge>}
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase">Matter Stage</p>
            <MatterStageBadge stage={item.matterStage} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Work Status</p>
              <StatusBadge status={item.status} className="mt-1" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Priority</p>
              <PriorityBadge priority={item.priority} className="mt-1" />
            </div>
          </div>

          {canEditMatterStage && <MatterStageEditor item={item} />}

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Conveyancing Timeline</p>
            <ConveyancingTimeline
              jurisdiction={item.jurisdiction}
              currentStage={item.matterStage}
              isWorkBlocked={item.status === "BLOCKED"}
            />
            {next && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Next Matter Stage:</span> {next}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {item.clientReference && (
              <>
                <dt className="text-muted-foreground">Client</dt>
                <dd>{item.clientReference}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Started</dt>
            <dd>{item.startedAt ? dateTimeFormat(item.startedAt) : "—"}</dd>
            <dt className="text-muted-foreground">Completed</dt>
            <dd>{item.completedAt ? dateTimeFormat(item.completedAt) : "—"}</dd>
            <dt className="text-muted-foreground">Est. completion</dt>
            <dd>{item.estimatedCompletion ? dateTimeFormat(item.estimatedCompletion) : "—"}</dd>
            <dt className="text-muted-foreground">Last updated</dt>
            <dd>{dateTimeFormat(item.updatedAt)}</dd>
          </dl>

          {item.notes && (
            <div className="grid gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">VA Note</p>
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
                {item.notes}
              </p>
            </div>
          )}

          {item.status === "BLOCKED" && (item.blockedReason || item.blockedNeeds) && (
            <div className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              <p className="font-medium text-destructive">Blocked</p>
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
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
              <StickyNote className="size-3.5" />
              Admin Notes
            </p>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin notes yet.</p>
            ) : (
              <ul className="grid gap-2">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-lg border bg-primary/5 px-3 py-2">
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {note.adminUser.name} · {dateTimeFormat(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {canAddAdminNote && <AddAdminNoteForm workItemId={item.id} />}
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Recent Activity</p>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="grid gap-2">
                {timeline.map((entry) => {
                  const stageChanged =
                    entry.newMatterStage && entry.previousMatterStage !== entry.newMatterStage;
                  const statusChanged = entry.previousStatus && entry.previousStatus !== entry.newStatus;
                  return (
                    <li key={entry.id} className="border-l-2 pl-3 text-sm">
                      <p className="text-xs text-muted-foreground">{dateTimeFormat(entry.createdAt)}</p>
                      {stageChanged && (
                        <p>
                          <span className="text-xs font-medium tracking-wide text-primary uppercase">
                            Matter Stage:
                          </span>{" "}
                          {entry.previousMatterStage && `${MATTER_STAGE_LABELS[entry.previousMatterStage]} → `}
                          <span className="font-medium">{MATTER_STAGE_LABELS[entry.newMatterStage!]}</span>
                        </p>
                      )}
                      {statusChanged ? (
                        <p>
                          {WORK_STATUS_LABELS[entry.previousStatus!]} →{" "}
                          <span className="font-medium">{WORK_STATUS_LABELS[entry.newStatus]}</span>
                        </p>
                      ) : (
                        !stageChanged && <p className="font-medium">Note added</p>
                      )}
                      {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                      <p className="text-xs text-muted-foreground">by {entry.user.name}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}
