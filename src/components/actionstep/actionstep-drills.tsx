"use client";

/**
 * Data entry drills — practice screen.
 *
 * Unlike the guided tasks (which check real actions against the log as the
 * trainee works through the live app), a drill hands over a source document
 * and a blank form, and only tells the trainee what they got right once they
 * submit. That delayed feedback is deliberate: it's what makes the exercise
 * about reading the document accurately rather than trial-and-error.
 */

import { useState } from "react";
import { ArrowLeft, Check, RotateCcw, Target, X } from "lucide-react";
import { AS_DRILLS } from "@/lib/actionstep/drills";
import { AsButton, AsInput, AsSelect, Panel } from "./actionstep-screens";
import { scoreDrill, useDrillRunner, type Drill } from "@/lib/training/drill";
import { cn } from "@/lib/utils";

const DIFFICULTY_STYLE: Record<Drill["difficulty"], string> = {
  Beginner: "bg-[#dcfce7] text-[#166534]",
  Core: "bg-[#dbeafe] text-[#1e40af]",
  Advanced: "bg-[#fee2e2] text-[#991b1b]",
};

function DrillList() {
  const { start } = useDrillRunner();
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f1f5f9] p-4">
      <div className="mx-auto grid max-w-[900px] gap-4">
        <div className="grid gap-1">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[#0f172a]">
            <Target className="size-4 text-[#e2622c]" />
            Data entry drills
          </h2>
          <p className="text-[12px] text-[#64748b]">
            Each drill gives you a real-looking document and a blank form. Read it, fill in the
            fields, then submit to see what you got right — nothing here touches a matter file.
          </p>
        </div>

        <div className="grid gap-2.5">
          {AS_DRILLS.map((drill) => (
            <button
              key={drill.id}
              type="button"
              onClick={() => start(drill.id)}
              className="grid gap-1.5 rounded border border-[#e2e8f0] bg-white p-3.5 text-left transition-colors hover:border-[#e2622c]/50 hover:bg-[#fff7f2]"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#0f172a]">{drill.title}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    DIFFICULTY_STYLE[drill.difficulty],
                  )}
                >
                  {drill.difficulty}
                </span>
                <span className="ml-auto text-[11px] text-[#94a3b8]">~{drill.minutes} min</span>
              </div>
              <p className="text-[12px] text-[#64748b]">{drill.summary}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrillDocumentCard({ drill }: { drill: Drill }) {
  return (
    <Panel title="Source document">
      <div className="grid gap-2.5 p-3.5 font-mono text-[12px] leading-relaxed text-[#1e293b]">
        <div>
          <div className="font-sans text-[13px] font-semibold text-[#0f172a]">
            {drill.document.heading}
          </div>
          {drill.document.meta && (
            <div className="font-sans text-[11px] text-[#94a3b8]">{drill.document.meta}</div>
          )}
        </div>
        {drill.document.paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </Panel>
  );
}

function DrillForm({ drill }: { drill: Drill }) {
  const { run, setAnswer, submit, retry, exit } = useDrillRunner();
  const [attempted, setAttempted] = useState(false);

  const allFilled = drill.fields.every((f) => (run.answers[f.key] ?? "").trim().length > 0);

  return (
    <Panel
      title="Enter the details"
      actions={
        <button
          type="button"
          onClick={exit}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748b] hover:text-[#0f172a]"
        >
          <ArrowLeft className="size-3.5" />
          All drills
        </button>
      }
    >
      <div className="grid gap-3 p-3.5">
        {drill.fields.map((f) => {
          const value = run.answers[f.key] ?? "";
          const result = run.results?.[f.key];
          return (
            <label key={f.key} className="grid gap-1">
              <span className="flex items-center gap-1.5 text-[11px] text-[#334155]">
                {f.label}
                {run.submitted &&
                  (result ? (
                    <Check className="size-3.5 text-[#16a34a]" />
                  ) : (
                    <X className="size-3.5 text-[#dc2626]" />
                  ))}
              </span>
              {f.type === "choice" ? (
                <AsSelect
                  value={value}
                  disabled={run.submitted}
                  onChange={(e) => setAnswer(f.key, e.target.value)}
                >
                  <option value="">—</option>
                  {(f.choices ?? []).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </AsSelect>
              ) : (
                <AsInput
                  type={f.type === "date" ? "date" : "text"}
                  value={value}
                  disabled={run.submitted}
                  placeholder={f.type === "money" ? "0.00" : undefined}
                  onChange={(e) => setAnswer(f.key, e.target.value)}
                />
              )}
              {run.submitted && !result && (
                <span className="text-[11px] text-[#dc2626]">
                  You entered: {value.trim() || "(nothing)"}
                </span>
              )}
            </label>
          );
        })}

        {attempted && !allFilled && !run.submitted && (
          <p className="text-[11px] text-[#dc2626]">Fill in every field before submitting.</p>
        )}

        {run.submitted && run.results && (
          <div
            className={cn(
              "rounded border p-2.5 text-[12px] font-semibold",
              Object.values(run.results).every(Boolean)
                ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                : "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
            )}
          >
            {Object.values(run.results).filter(Boolean).length} of {drill.fields.length} correct
          </div>
        )}

        <div className="flex justify-end gap-2">
          {run.submitted ? (
            <AsButton
              variant="secondary"
              onClick={() => {
                retry();
                setAttempted(false);
              }}
            >
              <RotateCcw className="size-3.5" />
              Try again
            </AsButton>
          ) : (
            <AsButton
              onClick={() => {
                setAttempted(true);
                if (!allFilled) return;
                submit(scoreDrill(drill, run.answers).results);
              }}
            >
              Check my entry
            </AsButton>
          )}
        </div>
      </div>
    </Panel>
  );
}

function DrillRun({ drill }: { drill: Drill }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f1f5f9] p-4">
      <div className="mx-auto grid max-w-[1080px] gap-3">
        <div className="grid gap-1">
          <h2 className="text-[15px] font-semibold text-[#0f172a]">{drill.title}</h2>
          <p className="text-[12px] text-[#64748b]">{drill.brief}</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-3">
          <DrillDocumentCard drill={drill} />
          <DrillForm drill={drill} />
        </div>
      </div>
    </div>
  );
}

export function ActionstepDrillsScreen() {
  const { run } = useDrillRunner();
  const active = run.drillId ? AS_DRILLS.find((d) => d.id === run.drillId) : null;
  return active ? <DrillRun drill={active} /> : <DrillList />;
}
