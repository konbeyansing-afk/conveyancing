"use client";

/** Root of the practice-system simulator: app window + guided-task panel. */

import { useState } from "react";
import { Maximize2, Minimize2, PanelRightOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulatorProvider, TaskRunnerProvider, useSim } from "@/lib/simulator/store";
import { cn } from "@/lib/utils";
import { CreateMatterScreen } from "./screens/create-matter-screen";
import { CreateLeadScreen, LeadScreen } from "./screens/lead-screens";
import { HomeScreen } from "./screens/home-screen";
import { MatterScreen } from "./screens/matter-screen";
import { TaskPanel } from "./task-panel";

function ScreenSwitch() {
  const { state } = useSim();
  switch (state.nav.screen) {
    case "matter":
      return <MatterScreen />;
    case "create-matter":
      return <CreateMatterScreen />;
    case "lead":
      return <LeadScreen />;
    case "create-lead":
      return <CreateLeadScreen />;
    default:
      return <HomeScreen />;
  }
}

function WorkbenchToolbar({
  panelOpen,
  onTogglePanel,
  fullscreen,
  onToggleFullscreen,
}: {
  panelOpen: boolean;
  onTogglePanel: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { dispatch } = useSim();
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Simulated practice management system — training data only
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
        <Button size="sm" variant="ghost" onClick={onToggleFullscreen}>
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          {fullscreen ? "Exit full screen" : "Full screen"}
        </Button>
        {!panelOpen && (
          <Button size="sm" variant="outline" onClick={onTogglePanel}>
            <PanelRightOpen className="size-3.5" />
            Guided tasks
          </Button>
        )}
      </div>
    </div>
  );
}

function WorkbenchInner() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        fullscreen
          ? "fixed inset-3 z-50 rounded-xl"
          : "h-[min(78vh,860px)] min-h-[620px]",
      )}
    >
      <WorkbenchToolbar
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen(true)}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ScreenSwitch />
        </div>
        {panelOpen && <TaskPanel onClose={() => setPanelOpen(false)} />}
      </div>
    </div>
  );
}

export function SimWorkbench() {
  return (
    <SimulatorProvider>
      <TaskRunnerProvider>
        <WorkbenchInner />
      </TaskRunnerProvider>
    </SimulatorProvider>
  );
}
