"use client";

/** The firm-level window: menu bar, ribbon, left rail and whichever pane is open. */

import { useState } from "react";
import {
  Activity as ActivityIcon,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  DollarSign,
  FileDown,
  FileStack,
  FileText,
  Maximize2,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  StickyNote,
  UserPlus,
  Users,
} from "lucide-react";
import { formatAuDate, formatAuDateTime, formatLongDate, formatMoney, useSim } from "@/lib/simulator/store";
import { cn } from "@/lib/utils";
import {
  FirmBar,
  HomeMenuBar,
  LeftRail,
  WindowTitleBar,
} from "../chrome/window-chrome";
import {
  EmptyPane,
  PaneHeader,
  RibbonButton,
  RibbonDivider,
  SimActionButton,
  SimCheckbox,
  SimPanel,

  SimTextarea,
} from "../sim-primitives";
import {
  MatterPickerDialog,
  NewContactDialog,
  PhoneMessageDialog,
  type RibbonDialog,
} from "../ribbon-dialogs";
import { DisbursementsGrid, TimeFeesGrid } from "../time-entry-forms";
import {
  ActivityPane,
  AmlPane,
  CalendarPane,
  ContactsPane,
  MattersPane,
  ReportsPane,
  SearchPane,
  TasksPane,
} from "./home-rail-panes";

/* ------------------------------------------------------------------ */
/* Ribbon                                                              */
/* ------------------------------------------------------------------ */

/** Reasons shown on hover for controls that are outside the simulation. */
const NOT_SIMULATED = {
  autoTime: "AutoTime records real keystrokes, so there's nothing to review here",
  timeFinder: "searches real recorded time across the firm",
  print: "printing isn't simulated",
  export: "exporting isn't simulated",
  popOut: "the simulator runs in one window",
  firm: "you only have one firm in the simulator",
  prefs: "app preferences aren't simulated",
  customise: "dashboard layout isn't simulated",
} as const;

function HomeRibbon({ onOpenDialog }: { onOpenDialog: (d: RibbonDialog) => void }) {
  const { state, dispatch } = useSim();
  const menu = state.nav.homeMenu;

  if (menu === "triconvey") {
    return (
      <div className="flex h-[74px] shrink-0 items-stretch border-b border-[#dfe5ec] bg-white px-2">
        <RibbonButton
          icon={FileStack}
          label="New Lead"
          tone="green"
          onClick={() => dispatch({ type: "OPEN_CREATE_LEAD" })}
        />
        <RibbonButton
          icon={FileText}
          label="New Matter"
          tone="blue"
          onClick={() => dispatch({ type: "OPEN_CREATE_MATTER" })}
        />
        <RibbonButton
          icon={UserPlus}
          label="New Contact"
          tone="purple"
          onClick={() => onOpenDialog("contact")}
        />
        <RibbonDivider />
        <RibbonButton
          icon={CalendarPlus}
          label="Event"
          tone="blue"
          onClick={() => dispatch({ type: "NAV_RAIL", rail: "calendar" })}
        />
        <RibbonButton
          icon={ClipboardList}
          label="Task"
          tone="purple"
          onClick={() => dispatch({ type: "NAV_RAIL", rail: "tasks" })}
        />
        <RibbonButton
          icon={Phone}
          label="Phone Message"
          tone="red"
          onClick={() => onOpenDialog("phone")}
        />
        <RibbonButton
          icon={ActivityIcon}
          label="Activity"
          tone="red"
          onClick={() => dispatch({ type: "NAV_RAIL", rail: "activity" })}
        />
        <RibbonButton
          icon={StickyNote}
          label="Memo"
          tone="blue"
          onClick={() => onOpenDialog("memo-picker")}
        />
        <RibbonDivider />
        <RibbonButton
          icon={DollarSign}
          label="Billing"
          tone="green"
          onClick={() => dispatch({ type: "NAV_HOME_MENU", menu: "time" })}
        />
        <RibbonButton
          icon={Star}
          label="Review AutoTime"
          tone="red"
          unavailable={NOT_SIMULATED.autoTime}
        />
        <RibbonButton
          icon={Clock}
          label="Time Finder"
          tone="red"
          unavailable={NOT_SIMULATED.timeFinder}
        />
      </div>
    );
  }

  if (menu === "time") {
    return (
      <div className="flex h-[74px] shrink-0 items-stretch border-b border-[#dfe5ec] bg-white px-2">
        <RibbonButton
          icon={Clock}
          label="Time/Fee"
          tone="red"
          onClick={() => dispatch({ type: "NAV_TIME_SUBTAB", subTab: "time" })}
        />
        <RibbonButton
          icon={DollarSign}
          label="Disbursement"
          tone="green"
          onClick={() => dispatch({ type: "NAV_TIME_SUBTAB", subTab: "disbursements" })}
        />
        <RibbonButton
          icon={Star}
          label="Review AutoTime"
          tone="red"
          unavailable={NOT_SIMULATED.autoTime}
        />
        <RibbonButton
          icon={Search}
          label="Time Finder"
          tone="red"
          unavailable={NOT_SIMULATED.timeFinder}
        />
        <RibbonDivider />
        <RibbonButton icon={Printer} label="Print" tone="blue" unavailable={NOT_SIMULATED.print} />
        <RibbonButton
          icon={FileDown}
          label="Export"
          tone="blue"
          unavailable={NOT_SIMULATED.export}
        />
        <RibbonButton
          icon={DollarSign}
          label="Billing"
          tone="green"
          onClick={() => dispatch({ type: "NAV_RAIL", rail: "reports" })}
        />
        <RibbonDivider />
        <RibbonButton
          icon={Maximize2}
          label="Pop Out"
          tone="blue"
          unavailable={NOT_SIMULATED.popOut}
        />
      </div>
    );
  }

  if (menu === "messages" || menu === "support") {
    return (
      <div className="flex h-[74px] shrink-0 items-stretch border-b border-[#dfe5ec] bg-white px-2">
        <RibbonButton
          icon={RefreshCw}
          label="Refresh"
          tone="blue"
          onClick={() => dispatch({ type: "NAV_HOME_MENU", menu })}
        />
        <RibbonButton
          icon={Maximize2}
          label="Pop Out"
          tone="blue"
          unavailable={NOT_SIMULATED.popOut}
        />
      </div>
    );
  }

  // FILE
  return (
    <div className="flex h-[74px] shrink-0 items-stretch border-b border-[#dfe5ec] bg-white px-2">
      <RibbonButton icon={Users} label="Switch Firm" tone="blue" unavailable={NOT_SIMULATED.firm} />
      <RibbonButton
        icon={Sparkles}
        label="Preferences"
        tone="purple"
        unavailable={NOT_SIMULATED.prefs}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function DailyDigest() {
  const { state, dispatch } = useSim();
  const todayEvents = state.events.filter((e) => e.start.startsWith(state.today));
  const todayTasks = state.tasks.filter(
    (t) => !t.completedOn && (t.dueOn === state.today || t.dueOn === null || t.dueOn < state.today),
  );
  const todayPhoneMessages = state.phoneMessages.filter((pm) => pm.takenAt.startsWith(state.today));

  return (
    <SimPanel title="Daily Digest" className="min-h-[240px]">
      <div className="flex items-center gap-3 border-b border-[#eef2f6] px-3 py-2">
        <span className="text-[15px] font-semibold text-[#22303f]">
          {formatLongDate(state.today)}
        </span>
        <div className="flex items-center gap-1 text-[#5b6b7d]">
          <ChevronLeft className="size-3.5" />
          <span className="text-[11px] font-semibold tracking-wide uppercase">Today</span>
          <ChevronRight className="size-3.5" />
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#e0c47a] bg-[#fdf6e3] px-2 py-px text-[11px] text-[#7a5c10]">
          <span className="grid size-4 place-items-center rounded-full bg-[#e0a93e] text-[9px] font-bold text-white">
            {state.user.initials}
          </span>
          {state.user.name}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-0">
        <div className="border-r border-[#eef2f6] p-3">
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
            Events
          </div>
          {todayEvents.length === 0 ? (
            <p className="text-[12px] text-[#8b98a6]">No events on this day</p>
          ) : (
            todayEvents.map((e) => (
              <div key={e.id} className="mb-1.5 text-[12px]">
                <div className="font-medium text-[#22303f]">{e.subject}</div>
                <div className="text-[#5b6b7d]">{e.start.split(" ").slice(1).join(" ")}</div>
              </div>
            ))
          )}
        </div>

        <div className="border-r border-[#eef2f6] p-3">
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
            Tasks
          </div>
          {todayTasks.length === 0 ? (
            <p className="text-[12px] text-[#8b98a6]">Nothing due</p>
          ) : (
            todayTasks.slice(0, 5).map((t) => {
              const m = state.matters.find((x) => x.id === t.matterId);
              const overdue = t.dueOn !== null && t.dueOn < state.today;
              return (
                <div key={t.id} className="mb-2 flex items-start gap-2 text-[12px]">
                  <SimCheckbox
                    checked={false}
                    onChange={() => dispatch({ type: "TOGGLE_TASK", taskId: t.id })}
                  />
                  <div className="min-w-0">
                    <div className={cn("font-medium", overdue ? "text-[#c8323b]" : "text-[#22303f]")}>
                      {t.name}
                    </div>
                    <div className="truncate text-[#5b6b7d]">
                      {m ? `${m.clientName} — ${m.type}` : "No matter"}
                      {overdue && " · overdue"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3">
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
            Phone messages
          </div>
          {todayPhoneMessages.length === 0 ? (
            <p className="text-[12px] text-[#8b98a6]">No phone messages on this day</p>
          ) : (
            todayPhoneMessages.map((pm) => {
              const m = state.matters.find((x) => x.id === pm.matterId);
              return (
                <div key={pm.id} className="mb-2 text-[12px]">
                  <div className="font-medium text-[#22303f]">{pm.caller}</div>
                  <div className="line-clamp-2 text-[#5b6b7d]">{pm.summary}</div>
                  <div className="text-[11px] text-[#8b98a6]">
                    {m ? m.clientName : "No matter"} · for {pm.forStaff}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SimPanel>
  );
}

function ActivityTimeline() {
  const { state } = useSim();
  const byKind = state.activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.kind] = (acc[a.kind] ?? 0) + a.hours;
    return acc;
  }, {});
  const total = Object.values(byKind).reduce((s, n) => s + n, 0);

  return (
    <SimPanel title="Activity timeline">
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 text-[11px]">
          <span className="rounded-[2px] bg-[#2f7fd0] px-2 py-px font-semibold text-white uppercase">
            Week
          </span>
          <span className="text-[#5b6b7d]">16/08/2026 – 22/08/2026</span>
        </div>
        <div className="grid gap-1.5">
          {Object.entries(byKind).map(([kind, hours]) => (
            <div key={kind} className="flex items-center gap-2 text-[12px]">
              <span className="w-[150px] shrink-0 text-[#3c4653]">{kind}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-[2px] bg-[#eef2f6]">
                <div
                  className="h-full bg-[#4aa3e8]"
                  style={{ width: `${total > 0 ? (hours / total) * 100 : 0}%` }}
                />
              </div>
              <span className="w-[52px] shrink-0 text-right text-[#5b6b7d]">
                {hours.toFixed(2)}h
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t border-[#eef2f6] pt-2 text-right text-[12px] font-semibold text-[#22303f]">
          {total.toFixed(2)} hours recorded
        </div>
      </div>
    </SimPanel>
  );
}

function DashboardPane() {
  const { state, dispatch } = useSim();
  const recent = state.matters.slice(0, 8);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f2f5f8] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-[2px] bg-[#2f7fd0] px-3 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
          Your dashboard
        </span>
        <button
          type="button"
          disabled
          title={`Customise — ${NOT_SIMULATED.customise}`}
          className="cursor-not-allowed text-[11px] font-semibold tracking-wide text-[#2f7fd0] uppercase opacity-40"
        >
          Customise
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3">
        <div className="grid content-start gap-3">
          <SimPanel title="My recently viewed">
            <div className="grid">
              {recent.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                  className="flex items-center gap-2 border-b border-[#eef2f6] px-3 py-1.5 text-left text-[12px] last:border-b-0 hover:bg-[#f2f7fc]"
                >
                  <FileText className="size-3.5 shrink-0 text-[#e0a93e]" />
                  <span className="truncate text-[#22303f]">
                    {m.number} — {m.clientName} · {m.propertyAddress}
                  </span>
                </button>
              ))}
            </div>
          </SimPanel>

          <SimPanel title="My recent documents">
            <div className="grid">
              {state.documents
                .filter((d) => d.kind !== "folder")
                .slice(0, 6)
                .map((d) => {
                  const m = state.matters.find((x) => x.id === d.matterId);
                  return (
                    <div
                      key={d.id}
                      className="border-b border-[#eef2f6] px-3 py-1.5 text-[12px] last:border-b-0"
                    >
                      <div className="truncate text-[#22303f]">{d.name}</div>
                      <div className="truncate text-[11px] text-[#5b6b7d]">
                        {m ? `${m.clientName} — ${m.type}` : ""} · {formatAuDate(d.dateModified)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </SimPanel>
        </div>

        <div className="grid content-start gap-3">
          <DailyDigest />
          <ActivityTimeline />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Messages menu body                                                  */
/* ------------------------------------------------------------------ */

function MessagesPane() {
  const { state, dispatch } = useSim();
  const staff = ["Jennie Tonner", "Harold Galvo", "Monika Stelzner"];
  const [active, setActive] = useState(staff[0]);
  const [draft, setDraft] = useState("");
  const thread = state.messages.filter((m) => m.withStaff === active);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[250px] shrink-0 overflow-auto border-r border-[#dfe5ec] bg-white p-2">
        <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
          Direct messages
        </span>
        <div className="mt-1 grid">
          {staff.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActive(s)}
              className={cn(
                "rounded-[2px] px-2 py-1.5 text-left text-[12px]",
                active === s ? "bg-[#dcebfa] font-medium text-[#22303f]" : "text-[#3c4653] hover:bg-[#f2f7fc]",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader>{active}</PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {thread.length === 0 ? (
            <EmptyPane>This is the beginning of your conversation.</EmptyPane>
          ) : (
            <div className="grid gap-2">
              {thread.map((m) => {
                const mine = m.from === state.user.name;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[70%] rounded-md px-3 py-2 text-[12px]",
                      mine
                        ? "ml-auto bg-[#dcebfa] text-[#22303f]"
                        : "bg-[#f2f5f8] text-[#22303f]",
                    )}
                  >
                    <div className="mb-0.5 text-[10px] font-semibold tracking-wide text-[#5b6b7d] uppercase">
                      {m.from} · {formatAuDateTime(m.sentAt)}
                    </div>
                    {m.body}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-[#dfe5ec] bg-[#f7fafc] p-2">
          <div className="mb-1 inline-block rounded-[2px] bg-[#7fe3c4] px-1.5 text-[10px] font-bold tracking-wide text-[#134d3c] uppercase">
            This conversation is private
          </div>
          <SimTextarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${active.split(" ")[0]}`}
            className="min-h-[56px]"
          />
          <div className="mt-1 flex justify-end">
            <SimActionButton
              variant="primary"
              disabled={draft.trim().length === 0}
              onClick={() => {
                dispatch({
                  type: "SEND_MESSAGE",
                  withStaff: active,
                  matterId: null,
                  body: draft.trim(),
                });
                setDraft("");
              }}
            >
              Send
            </SimActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Firm-wide Time & Disbursements body                                 */
/* ------------------------------------------------------------------ */

function FirmTimePane() {
  const { state, dispatch } = useSim();
  const sub = state.nav.timeSubTab;
  const billable = state.timeEntries.filter((t) => t.billable).reduce((s, t) => s + t.amountExGst, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-end gap-0 border-b border-[#dfe5ec] bg-[#e8eef4] px-1 pt-1">
        {(
          [
            { key: "time", label: "Time & Fees" },
            { key: "disbursements", label: "Disbursements" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => dispatch({ type: "NAV_TIME_SUBTAB", subTab: t.key })}
            className={cn(
              "px-4 py-1.5 text-[11px] font-semibold tracking-wide uppercase",
              sub === t.key
                ? "border border-b-0 border-[#dfe5ec] bg-white text-[#22303f]"
                : "text-[#5b6b7d] hover:text-[#22303f]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-3 border-b border-[#dfe5ec] bg-white px-3 py-2">
        <span className="text-[15px] font-semibold text-[#22303f]">
          {formatLongDate(state.today)}
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] text-[#5b6b7d]">
          <span className="grid size-4 place-items-center rounded-full bg-[#8b98a6] text-[9px] font-bold text-white">
            {state.user.initials}
          </span>
          {state.user.name}
        </span>
        <span className="ml-auto text-[12px] text-[#3c4653]">
          Billable across all matters:{" "}
          <span className="font-semibold">{formatMoney(billable)}</span>
        </span>
      </div>
      {sub === "time" ? <TimeFeesGrid /> : <DisbursementsGrid />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* File menu body                                                      */
/* ------------------------------------------------------------------ */

function FilePane() {
  const { state } = useSim();
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f2f5f8] p-6">
      <SimPanel title="File" className="max-w-[520px]">
        <div className="grid gap-2 p-4 text-[12px] text-[#22303f]">
          <div className="flex justify-between border-b border-[#eef2f6] pb-1.5">
            <span>Signed in as</span>
            <span className="font-semibold">{state.user.name}</span>
          </div>
          <div className="flex justify-between border-b border-[#eef2f6] pb-1.5">
            <span>Firm</span>
            <span className="font-semibold">{state.user.firm}</span>
          </div>
          <div className="flex justify-between">
            <span>Version</span>
            <span className="font-semibold">Simulator build — training only</span>
          </div>
        </div>
      </SimPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Support menu body                                                   */
/* ------------------------------------------------------------------ */

function SupportPane() {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="bg-gradient-to-r from-[#0b2a4a] to-[#1e5c8f] px-8 py-12 text-white">
        <div className="text-[26px] font-semibold">Help Centre</div>
        <p className="mt-1 max-w-[520px] text-[13px] text-white/80">
          In the live system this is where you raise a ticket, browse the knowledge base, and check
          system status. In the simulator it is here so the tab strip matches what you will see at
          work.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 p-8">
        {[
          { title: "Library", body: "A knowledge base of articles, videos and help guides." },
          { title: "Raise a ticket", body: "Log an issue with the vendor's support team." },
          { title: "Notice board", body: "Planned maintenance and release notes." },
        ].map((c) => (
          <div key={c.title} className="border border-[#dfe5ec] p-4">
            <div className="text-[14px] font-semibold text-[#1e5c8f]">{c.title}</div>
            <p className="mt-1 text-[12px] text-[#5b6b7d]">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Home screen shell                                                   */
/* ------------------------------------------------------------------ */

export function HomeScreen() {
  const { state } = useSim();
  const [dialog, setDialog] = useState<RibbonDialog>(null);
  const { homeMenu, rail } = state.nav;

  let body: React.ReactNode;
  if (homeMenu === "file") body = <FilePane />;
  else if (homeMenu === "support") body = <SupportPane />;
  else if (homeMenu === "messages") body = <MessagesPane />;
  else if (homeMenu === "time") body = <FirmTimePane />;
  else {
    switch (rail) {
      case "matters":
        body = <MattersPane />;
        break;
      case "contacts":
        body = <ContactsPane />;
        break;
      case "calendar":
        body = <CalendarPane />;
        break;
      case "tasks":
        body = <TasksPane />;
        break;
      case "activity":
        body = <ActivityPane />;
        break;
      case "reports":
        body = <ReportsPane />;
        break;
      case "aml":
        body = <AmlPane />;
        break;
      case "search":
        body = <SearchPane />;
        break;
      default:
        body = <DashboardPane />;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <WindowTitleBar title={`triConvey — ${state.user.firm}`} />
      <HomeMenuBar />
      <HomeRibbon onOpenDialog={setDialog} />
      <FirmBar />
      <div className="relative flex min-h-0 flex-1">
        <LeftRail />
        <div className="flex min-w-0 flex-1 flex-col">{body}</div>
        {dialog === "contact" && <NewContactDialog onClose={() => setDialog(null)} />}
        {dialog === "phone" && <PhoneMessageDialog onClose={() => setDialog(null)} />}
        {dialog === "memo-picker" && (
          <MatterPickerDialog
            title="New memo — choose a matter"
            tab="memos"
            onClose={() => setDialog(null)}
          />
        )}
      </div>
    </div>
  );
}


