"use client";

/**
 * Apply Workflow — drops a firm's standard task list onto a matter.
 *
 * Each workflow task carries a due-date rule relative to a critical date
 * (matter opened / settlement), which is resolved against this matter when the
 * workflow is applied.
 */

import { useState } from "react";
import { CalendarClock, FileText } from "lucide-react";
import { describeDueRule, formatAuDate, resolveDueDate, useSim } from "@/lib/simulator/store";
import { cn } from "@/lib/utils";
import { SimActionButton, SimDialog, SimTag } from "./sim-primitives";

export function ApplyWorkflowDialog({
  matterId,
  onClose,
}: {
  matterId: string;
  onClose: () => void;
}) {
  const { state, dispatch } = useSim();
  const matter = state.matters.find((m) => m.id === matterId);
  const applicable = state.workflows.filter((w) => matter && w.matterTypes.includes(matter.type));
  const [selected, setSelected] = useState(applicable[0]?.id ?? "");

  if (!matter) return null;
  const workflow = state.workflows.find((w) => w.id === selected);

  return (
    <SimDialog
      title="Apply Workflow"
      width={640}
      onClose={onClose}
      footer={
        <>
          <SimActionButton variant="plain" onClick={onClose}>
            Cancel
          </SimActionButton>
          <SimActionButton
            variant="primary"
            disabled={!workflow}
            onClick={() => {
              if (!workflow) return;
              dispatch({ type: "APPLY_WORKFLOW", matterId, workflowId: workflow.id });
              onClose();
            }}
          >
            Apply Workflow
          </SimActionButton>
        </>
      }
    >
      {applicable.length === 0 ? (
        <p className="text-[12px] text-[#5b6b7d]">
          No workflow is set up for a {matter.type} matter.
        </p>
      ) : (
        <>
          <div className="grid gap-1.5">
            {applicable.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelected(w.id)}
                className={cn(
                  "flex items-center gap-2 rounded-[2px] border px-2.5 py-2 text-left text-[12px]",
                  selected === w.id
                    ? "border-[#2f7fd0] bg-[#dcebfa]"
                    : "border-[#dfe5ec] bg-white hover:bg-[#f7fafc]",
                )}
              >
                <span className="font-medium text-[#22303f]">{w.name}</span>
                <span className="text-[#5b6b7d]">{w.tasks.length} tasks</span>
                {w.alwaysApplyToNew && (
                  <SimTag tone="gray" className="ml-auto">
                    Auto-applied to new matters
                  </SimTag>
                )}
              </button>
            ))}
          </div>

          {workflow && (
            <div className="mt-1 border border-[#dfe5ec]">
              <div className="border-b border-[#dfe5ec] bg-[#eef3f8] px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
                Tasks that will be created
              </div>
              <div className="max-h-[260px] overflow-auto">
                {workflow.tasks.map((t) => {
                  const due = resolveDueDate(t.dueRule, matter.createdAt, matter.settlementDate);
                  return (
                    <div
                      key={t.id}
                      className="border-b border-[#eef2f6] px-2.5 py-2 text-[12px] last:border-b-0"
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 font-medium text-[#22303f]">{t.name}</span>
                        <span className="shrink-0 text-[11px] text-[#5b6b7d]">{t.priority}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#5b6b7d]">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3" />
                          {due ? formatAuDate(due) : "No due date"}
                          <span className="text-[#8b98a6]">({describeDueRule(t.dueRule)})</span>
                        </span>
                        <span>{t.assign}</span>
                        {t.linkedPrecedent && (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="size-3" />
                            {t.linkedPrecedent}
                          </span>
                        )}
                      </div>
                      {t.details && (
                        <div className="mt-0.5 text-[11px] text-[#5b6b7d]">{t.details}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!matter.settlementDate && (
            <p className="text-[11px] text-[#7a5c10]">
              This matter has no settlement date yet, so tasks due relative to settlement will be
              created with no due date. Set the settlement date and they can be dated properly.
            </p>
          )}
        </>
      )}
    </SimDialog>
  );
}
