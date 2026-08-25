"use client";

/** Title bar, menu bar, firm bar and left rail of the simulated app window. */

import {
  Activity,
  BarChart3,
  Calendar,
  CircleHelp,
  Clock,
  Contact,
  HelpCircle,
  Home,
  LayoutDashboard,
  Minus,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Target,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSim } from "@/lib/simulator/store";
import type { HomeMenu, HomeRail } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";
import { SimInput } from "../sim-primitives";

/* ------------------------------------------------------------------ */
/* Title bar                                                           */
/* ------------------------------------------------------------------ */

export function WindowTitleBar({
  title,
  dark = false,
}: {
  title: string;
  /** The matter window's title bar sits on the dark header. */
  dark?: boolean;
}) {
  const { state } = useSim();
  return (
    <div
      className={cn(
        "flex h-[30px] shrink-0 items-center gap-2 px-2",
        dark ? "bg-transparent text-white/85" : "border-b border-[#e4e9ef] bg-[#fbfcfd]",
      )}
    >
      <div className="flex-1" />
      <span className={cn("text-[12px]", dark ? "text-white/80" : "text-[#5b6b7d]")}>{title}</span>
      <div className="flex flex-1 items-center justify-end gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px]",
            dark
              ? "border-white/30 text-white/85"
              : "border-[#2f7fd0]/50 bg-white text-[#2f4f6d]",
          )}
        >
          <Clock className="size-3" />
          00:00:00
        </span>
        {!dark && (
          <>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-[#b8860b] uppercase">
              <UserRound className="size-3.5" />
              {state.user.name}
            </span>
            <span className="grid size-4 place-items-center rounded-full bg-[#e8434c] text-[9px] font-bold text-white">
              2
            </span>
          </>
        )}
        {/* Part of the drawn window frame — not interactive in the simulator. */}
        <span
          title="Window controls are part of the simulated frame and don't do anything here"
          className="flex cursor-default items-center gap-2 opacity-60"
        >
          <Settings className={cn("size-4", dark ? "text-white/70" : "text-[#5b6b7d]")} />
          <HelpCircle className={cn("size-4", dark ? "text-white/70" : "text-[#5b6b7d]")} />
          <Minus className={cn("size-4", dark ? "text-white/70" : "text-[#5b6b7d]")} />
          <Square className={cn("size-3", dark ? "text-white/70" : "text-[#5b6b7d]")} />
          <X className="size-4 text-[#e8434c]" />
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu bar                                                            */
/* ------------------------------------------------------------------ */

const HOME_MENUS: { key: HomeMenu; label: string }[] = [
  { key: "file", label: "File" },
  { key: "triconvey", label: "triConvey" },
  { key: "messages", label: "Messages" },
  { key: "time", label: "Time & Disbursements" },
  { key: "support", label: "Support" },
];

export function HomeMenuBar() {
  const { state, dispatch } = useSim();
  return (
    <div className="flex h-[26px] shrink-0 items-end gap-0 border-b border-[#dfe5ec] bg-white px-1">
      {HOME_MENUS.map((m) => {
        const active = state.nav.homeMenu === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => dispatch({ type: "NAV_HOME_MENU", menu: m.key })}
            className={cn(
              "h-[26px] px-3 text-[11px] font-semibold tracking-wide uppercase transition-colors",
              active
                ? "border border-b-0 border-[#dfe5ec] bg-white text-[#22303f]"
                : "text-[#5b6b7d] hover:bg-[#f2f7fc]",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Firm bar (logo + quick search)                                      */
/* ------------------------------------------------------------------ */

export function FirmBar() {
  const { state, dispatch } = useSim();
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-[#dfe5ec] bg-[#f7fafc] px-3">
      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[#2f7fd0] text-[8px] font-bold text-[#2f7fd0]">
        tri
      </span>
      <span className="text-[13px] font-semibold text-[#22303f]">{state.user.firm}</span>
      <button
        type="button"
        onClick={() => dispatch({ type: "OPEN_DRILLS" })}
        className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#2f7fd0] hover:underline"
      >
        <Target className="size-3.5" />
        Practice
      </button>
      <div className="flex flex-1 justify-end">
        <div className="relative w-[420px] max-w-[45%]">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[#2f7fd0]" />
          <SimInput
            placeholder="Quick Search"
            className="h-[24px] w-full border-[#b9d3ec] pl-7 text-[12px] italic"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const value = (e.target as HTMLInputElement).value.trim();
              if (value.length > 0) dispatch({ type: "SEARCH", query: value });
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Left rail                                                           */
/* ------------------------------------------------------------------ */

const RAIL_ITEMS: { key: HomeRail; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "matters", label: "Matters", icon: LayoutDashboard },
  { key: "contacts", label: "Contacts", icon: Contact },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "tasks", label: "Tasks", icon: CircleHelp },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "aml", label: "AML", icon: ShieldCheck },
  { key: "search", label: "Search", icon: Search },
];

export function LeftRail() {
  const { state, dispatch } = useSim();
  return (
    <nav className="flex w-[70px] shrink-0 flex-col border-r border-[#dfe5ec] bg-white">
      {RAIL_ITEMS.map((item) => {
        const active = state.nav.rail === item.key && state.nav.screen === "home";
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => dispatch({ type: "NAV_RAIL", rail: item.key })}
            className={cn(
              "flex flex-col items-center gap-1 border-b border-[#eef2f6] py-2.5 transition-colors",
              active ? "bg-[#eef3f8]" : "hover:bg-[#f5f9fc]",
            )}
          >
            <Icon className="size-[19px] stroke-[1.5] text-[#3c4653]" />
            <span className="text-[9px] font-semibold tracking-wide text-[#4a5768] uppercase">
              {item.label}
            </span>
          </button>
        );
      })}
      <div className="flex flex-1 items-end justify-center pb-3">
        <span className="text-[10px] font-semibold text-[#2f7fd0] [writing-mode:vertical-rl] [transform:rotate(180deg)]">
          triConvey
        </span>
      </div>
    </nav>
  );
}
