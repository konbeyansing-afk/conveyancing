"use client";

/** Root of the PEXA simulator: workspace app plus the shared training panel. */

import { useState } from "react";
import { Maximize2, Minimize2, PanelRightOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskPanel } from "@/components/training/task-panel";
import { PEXA_GUIDED_TASKS } from "@/lib/pexa/guided-tasks";
import { PexaProvider, usePexa } from "@/lib/pexa/store";
import { TaskRunnerProvider } from "@/lib/training/runner";
import { cn } from "@/lib/utils";
import { PexaCreateWorkspace, PexaDashboard, PexaWorkspaceScreen } from "./pexa-screens";

function ScreenSwitch() {
  const { state } = usePexa();
  switch (state.nav.screen) {
    case "workspace":
      return <PexaWorkspaceScreen />;
    case "create-workspace":
      return <PexaCreateWorkspace />;
    default:
      return <PexaDashboard />;
  }
}

/** PEXA's own top bar, so it doesn't read as the practice management system. */
function PexaTopBar() {
  const { state, dispatch } = usePexa();
  return (
    <div className="flex shrink-0 items-center gap-3 bg-[#12263a] px-4 py-2.5 text-white">
      <button
        type="button"
        onClick={() => dispatch({ type: "CLOSE_WORKSPACE" })}
        className="text-[16px] font-bold tracking-tight"
      >
        PEXA
      </button>
      <span className="text-[12px] text-white/60">Exchange</span>
      <div className="ml-auto flex items-center gap-3 text-[12px] text-white/80">
        <span>{state.user.subscriber}</span>
        <span className="grid size-6 place-items-center rounded-full bg-[#00b0b9] text-[10px] font-bold text-white">
          {state.user.name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </span>
      </div>
    </div>
  );
}

function PexaTaskPanel({ onClose }: { onClose: () => void }) {
  const { state } = usePexa();
  return (
    <TaskPanel
      tasks={PEXA_GUIDED_TASKS}
      state={state}
      actionCount={state.log.length}
      intro="Pick a scenario. You'll get a realistic instruction, then do the work in the PEXA workspace on the left — each step is checked as you go."
      footnote="This is a simulated workspace. No funds move and nothing is lodged with any land registry."
      onClose={onClose}
    />
  );
}

function WorkbenchInner() {
  const { dispatch } = usePexa();
  const [panelOpen, setPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        fullscreen ? "fixed inset-3 z-50 rounded-xl" : "h-[min(78vh,860px)] min-h-[620px]",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Simulated PEXA workspace — training data only
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => dispatch({ type: "RESET" })}
            title="Reset the simulator back to its starting data"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {fullscreen ? "Exit full screen" : "Full screen"}
          </Button>
          {!panelOpen && (
            <Button size="sm" variant="outline" onClick={() => setPanelOpen(true)}>
              <PanelRightOpen className="size-3.5" />
              Guided tasks
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <PexaTopBar />
          <ScreenSwitch />
        </div>
        {panelOpen && <PexaTaskPanel onClose={() => setPanelOpen(false)} />}
      </div>
    </div>
  );
}

export function PexaWorkbench() {
  return (
    <PexaProvider>
      <TaskRunnerProvider>
        <WorkbenchInner />
      </TaskRunnerProvider>
    </PexaProvider>
  );
}
