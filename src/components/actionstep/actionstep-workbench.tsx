"use client";

/** Root of the Actionstep simulator: the app plus the shared training panel. */

import { useState } from "react";
import {
  BookUser,
  House,
  ListChecks,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  RotateCcw,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskPanel } from "@/components/training/task-panel";
import { AS_GUIDED_TASKS } from "@/lib/actionstep/guided-tasks";
import { ActionstepProvider, type GlobalScreen, useActionstep } from "@/lib/actionstep/store";
import { TaskRunnerProvider, useTaskRunner } from "@/lib/training/runner";
import { cn } from "@/lib/utils";
import {
  ActionstepContactsScreen,
  ActionstepCreateMatter,
  ActionstepHome,
  ActionstepMattersList,
  ActionstepMatterScreen,
  ActionstepTasksScreen,
} from "./actionstep-screens";

function ScreenSwitch() {
  const { state } = useActionstep();
  switch (state.nav.screen) {
    case "matter":
      return <ActionstepMatterScreen />;
    case "create-matter":
      return <ActionstepCreateMatter />;
    case "matters":
      return <ActionstepMattersList />;
    case "tasks":
      return <ActionstepTasksScreen />;
    case "contacts":
      return <ActionstepContactsScreen />;
    case "home":
    default:
      return <ActionstepHome />;
  }
}

/**
 * Level 1 — the global bar. Present on every screen, including inside a
 * matter, because it is for moving between matters or doing something that
 * is not tied to one. This is deliberately a small, honest slice of a real
 * system's global menu: every item here goes to a screen this simulator
 * actually has real data behind, rather than a decorative link to nowhere.
 */
const GLOBAL_ITEMS: { key: GlobalScreen; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "Home", icon: House },
  { key: "matters", label: "Matters", icon: Search },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "contacts", label: "Contacts", icon: BookUser },
];

function GlobalNav() {
  const { state, dispatch } = useActionstep();
  const active = state.nav.screen === "matter" || state.nav.screen === "create-matter"
    ? null
    : state.nav.screen;

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-[#1e293b] px-3 py-1.5">
      {GLOBAL_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => dispatch({ type: "NAV_GLOBAL", screen: item.key })}
          className={cn(
            "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
            active === item.key
              ? "bg-[#e2622c] text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          <item.icon className="size-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TopBar() {
  const { state, dispatch } = useActionstep();
  return (
    <div className="flex shrink-0 items-center gap-3 bg-[#0f172a] px-4 py-2.5 text-white">
      <button
        type="button"
        onClick={() => dispatch({ type: "NAV_GLOBAL", screen: "home" })}
        className="text-[15px] font-bold tracking-tight"
      >
        <span className="text-[#e2622c]">action</span>step
      </button>
      <div className="ml-auto flex items-center gap-3 text-[12px] text-white/80">
        <span>{state.user.firm}</span>
        <span className="grid size-6 place-items-center rounded-full bg-[#e2622c] text-[10px] font-bold text-white">
          {state.user.name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </span>
      </div>
    </div>
  );
}

function AsTaskPanel({ onClose }: { onClose: () => void }) {
  const { state } = useActionstep();
  return (
    <TaskPanel
      tasks={AS_GUIDED_TASKS}
      state={state}
      actionCount={state.log.length}
      intro="Pick a scenario. You'll get a realistic instruction, then do the work in Actionstep on the left — each step is checked as you go."
      footnote="This is a simulated system with invented matters. Nothing here touches a real file."
      onClose={onClose}
    />
  );
}

function WorkbenchInner() {
  const { dispatch } = useActionstep();
  const { stopTask } = useTaskRunner();
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
          Simulated practice management system — training data only
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
            // The running scenario's ticked-off steps describe work that the
            // reset has just discarded, so drop it too.
            stopTask();
            dispatch({ type: "RESET" });
          }}
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
          <TopBar />
          <GlobalNav />
          <ScreenSwitch />
        </div>
        {panelOpen && <AsTaskPanel onClose={() => setPanelOpen(false)} />}
      </div>
    </div>
  );
}

export function ActionstepWorkbench() {
  return (
    <ActionstepProvider>
      <TaskRunnerProvider storageKey="conveyancing-academy:task:actionstep">
        <WorkbenchInner />
      </TaskRunnerProvider>
    </ActionstepProvider>
  );
}
