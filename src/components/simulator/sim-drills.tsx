"use client";

/**
 * Data entry drills — practice screen.
 *
 * Same pattern as the Actionstep and PEXA simulators' drill modes (see
 * src/lib/training/drill.tsx): a source document and a blank form, scored
 * only once the trainee submits, so the exercise is about reading the
 * document accurately rather than trial and error.
 */

import { useState } from "react";
import { ArrowLeft, Check, RotateCcw, Target, X } from "lucide-react";
import { SIM_DRILLS } from "@/lib/simulator/drills";
import { useSim } from "@/lib/simulator/store";
import { WindowTitleBar } from "./chrome/window-chrome";
import {
  SimActionButton,
  SimFieldLabel,
  SimInput,
  SimPanel,
  SimSelect,
} from "./sim-primitives";
import { scoreDrill, useDrillRunner, type Drill } from "@/lib/training/drill";
import { cn } from "@/lib/utils";

const DIFFICULTY_STYLE: Record<Drill["difficulty"], string> = {
  Beginner: "bg-[#dcfce7] text-[#166534]",
  Core: "bg-[#dbeafe] text-[#1e40af]",
  Advanced: "bg-[#fee2e2] text-[#991b1b]",
};

function DrillList() {
  const { dispatch } = useSim();
  const { start } = useDrillRunner();
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#eef1f5] p-4">
      <div className="mx-auto grid max-w-[900px] gap-4">
        <button
          type="button"
          onClick={() => dispatch({ type: "CLOSE_MATTER" })}
          className="inline-flex w-fit items-center gap-1 text-[12px] text-[#2f7fd0] hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </button>

        <div className="grid gap-1">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[#22303f]">
            <Target className="size-4 text-[#2f7fd0]" />
            Data entry drills
          </h2>
          <p className="text-[12px] text-[#5b6b7d]">
            Each drill gives you a real-looking document and a blank form. Read it, fill in the
            fields, then submit to see what you got right — nothing here touches a matter.
          </p>
        </div>

        <div className="grid gap-2.5">
          {SIM_DRILLS.map((drill) => (
            <button
              key={drill.id}
              type="button"
              onClick={() => start(drill.id)}
              className="grid gap-1.5 rounded border border-[#dfe5ec] bg-white p-3.5 text-left transition-colors hover:border-[#2f7fd0]/50 hover:bg-[#f2f7fc]"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#22303f]">{drill.title}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    DIFFICULTY_STYLE[drill.difficulty],
                  )}
                >
                  {drill.difficulty}
                </span>
                <span className="ml-auto text-[11px] text-[#9aa8b6]">~{drill.minutes} min</span>
              </div>
              <p className="text-[12px] text-[#5b6b7d]">{drill.summary}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrillDocumentCard({ drill }: { drill: Drill }) {
  return (
    <SimPanel title="Source document">
      <div className="grid gap-2.5 p-3.5 font-mono text-[12px] leading-relaxed text-[#22303f]">
        <div>
          <div className="font-sans text-[13px] font-semibold text-[#22303f]">
            {drill.document.heading}
          </div>
          {drill.document.meta && (
            <div className="font-sans text-[11px] text-[#9aa8b6]">{drill.document.meta}</div>
          )}
        </div>
        {drill.document.paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </SimPanel>
  );
}

function DrillForm({ drill }: { drill: Drill }) {
  const { run, setAnswer, submit, retry, exit } = useDrillRunner();
  const [attempted, setAttempted] = useState(false);

  const allFilled = drill.fields.every((f) => (run.answers[f.key] ?? "").trim().length > 0);

  return (
    <SimPanel
      title="Enter the details"
      actions={
        <button
          type="button"
          onClick={exit}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5b6b7d] hover:text-[#22303f]"
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
              <span className="flex items-center gap-1.5">
                <SimFieldLabel>{f.label}</SimFieldLabel>
                {run.submitted &&
                  (result ? (
                    <Check className="size-3.5 text-[#2f6b39]" />
                  ) : (
                    <X className="size-3.5 text-[#b3261e]" />
                  ))}
              </span>
              {f.type === "choice" ? (
                <SimSelect
                  value={value}
                  disabled={run.submitted}
                  onChange={(e) => setAnswer(f.key, e.target.value)}
                >
                  <option value="">—</option>
                  {(f.choices ?? []).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </SimSelect>
              ) : (
                <SimInput
                  type={f.type === "date" ? "date" : "text"}
                  value={value}
                  disabled={run.submitted}
                  placeholder={f.type === "money" ? "0.00" : undefined}
                  onChange={(e) => setAnswer(f.key, e.target.value)}
                />
              )}
              {run.submitted && !result && (
                <span className="text-[11px] text-[#b3261e]">
                  You entered: {value.trim() || "(nothing)"}
                </span>
              )}
            </label>
          );
        })}

        {attempted && !allFilled && !run.submitted && (
          <p className="text-[11px] text-[#b3261e]">Fill in every field before submitting.</p>
        )}

        {run.submitted && run.results && (
          <div
            className={cn(
              "rounded border p-2.5 text-[12px] font-semibold",
              Object.values(run.results).every(Boolean)
                ? "border-[#a8ce9f] bg-[#eef7ec] text-[#2f6b39]"
                : "border-[#f0d78c] bg-[#fdf6e3] text-[#8a6412]",
            )}
          >
            {Object.values(run.results).filter(Boolean).length} of {drill.fields.length} correct
          </div>
        )}

        <div className="flex justify-end gap-2">
          {run.submitted ? (
            <SimActionButton
              variant="plain"
              onClick={() => {
                retry();
                setAttempted(false);
              }}
            >
              <RotateCcw className="mr-1 inline size-3.5" />
              Try again
            </SimActionButton>
          ) : (
            <SimActionButton
              variant="primary"
              onClick={() => {
                setAttempted(true);
                if (!allFilled) return;
                submit(scoreDrill(drill, run.answers).results);
              }}
            >
              Check my entry
            </SimActionButton>
          )}
        </div>
      </div>
    </SimPanel>
  );
}

function DrillRun({ drill }: { drill: Drill }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#eef1f5] p-4">
      <div className="mx-auto grid max-w-[1080px] gap-3">
        <div className="grid gap-1">
          <h2 className="text-[15px] font-semibold text-[#22303f]">{drill.title}</h2>
          <p className="text-[12px] text-[#5b6b7d]">{drill.brief}</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-3">
          <DrillDocumentCard drill={drill} />
          <DrillForm drill={drill} />
        </div>
      </div>
    </div>
  );
}

export function DrillsScreen() {
  const { run } = useDrillRunner();
  const active = run.drillId ? SIM_DRILLS.find((d) => d.id === run.drillId) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <WindowTitleBar title="Data Entry Drills" />
      {active ? <DrillRun drill={active} /> : <DrillList />}
    </div>
  );
}
