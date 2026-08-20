"use client";

/** The body of each left-rail destination on the simulated home window. */

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Search,
  UserRound,
} from "lucide-react";
import { SIM_STAFF } from "@/lib/simulator/seed";
import { formatAuDate, formatLongDate, formatMoney, useSim } from "@/lib/simulator/store";
import type { ActivityKind, MatterType, SimActivity, SimMatter } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";
import {
  EmptyPane,
  GridCell,
  GridHeader,
  GridRow,
  PaneHeader,
  SimActionButton,
  SimCheckbox,
  SimInput,
  SimSelect,
  SimTag,
} from "../sim-primitives";

/* ------------------------------------------------------------------ */
/* Matters                                                             */
/* ------------------------------------------------------------------ */

const MATTER_FOLDERS: (MatterType | "All")[] = [
  "All",
  "Purchase",
  "Sale",
  "Transfer",
  "Survivorship Application",
];

export function MattersPane() {
  const { state, dispatch } = useSim();
  const [treeOpen, setTreeOpen] = useState(true);
  const [showLeads, setShowLeads] = useState(false);
  const folder = state.nav.matterFolder;
  const openLeads = state.leads.filter((l) => l.status !== "Converted");

  const rows = useMemo(
    () =>
      state.matters.filter((m) => (folder === "All" ? true : m.type === folder)),
    [state.matters, folder],
  );

  const label = folder === "All" ? "ALL MATTERS" : `ALL ${folder.toUpperCase()} MATTERS`;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Folder tree */}
      <div className="w-[240px] shrink-0 overflow-auto border-r border-[#dfe5ec] bg-white p-2 text-[12px]">
        <button
          type="button"
          onClick={() => setShowLeads((v) => !v)}
          className={cn(
            "flex w-full items-center gap-1 rounded-[2px] py-1 text-left font-semibold",
            showLeads ? "text-[#22303f]" : "text-[#3c4653]",
          )}
        >
          {showLeads ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <Folder className="size-3.5 text-[#2f7d72]" />
          Leads
          <span className="ml-auto rounded-full bg-[#eef2f6] px-1.5 text-[10px] font-normal text-[#5b6b7d]">
            {openLeads.length}
          </span>
        </button>
        {showLeads && (
          <div className="mb-2 grid pl-5">
            {openLeads.length === 0 ? (
              <span className="py-1 text-[11px] text-[#8b98a6]">No open leads.</span>
            ) : (
              openLeads.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => dispatch({ type: "OPEN_LEAD", leadId: l.id })}
                  className="truncate rounded-[2px] px-1.5 py-1 text-left text-[11px] text-[#2f7d72] hover:bg-[#eaf5f3]"
                >
                  {l.clientName} — {l.leadType}
                </button>
              ))
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setTreeOpen((v) => !v)}
          className="flex w-full items-center gap-1 py-1 text-left font-semibold text-[#22303f]"
        >
          {treeOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <Folder className="size-3.5 text-[#e0a93e]" />
          Matters
        </button>
        {treeOpen && (
          <div className="pl-5">
            <div className="flex items-center gap-1 py-1 text-[#3c4653]">
              <ChevronDown className="size-3.5" />
              <Folder className="size-3.5 text-[#e0a93e]" />
              Conveyancing
            </div>
            <div className="pl-5">
              {MATTER_FOLDERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => dispatch({ type: "NAV_MATTER_FOLDER", folder: f })}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-[2px] px-1.5 py-1 text-left",
                    folder === f ? "bg-[#dcebfa] text-[#22303f]" : "text-[#3c4653] hover:bg-[#f2f7fc]",
                  )}
                >
                  <Building2 className="size-3.5 text-[#5b6b7d]" />
                  {f === "All" ? "All matters" : f}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-[#eef2f6] pt-2">
          <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
            Recently viewed
          </span>
          <div className="mt-1 grid">
            {state.log
              .filter((l) => l.type === "nav.matter.open")
              .slice(-6)
              .reverse()
              .map((l) => {
                const m = state.matters.find((x) => x.id === l.matterId);
                if (!m) return null;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                    className="truncate py-0.5 text-left text-[11px] text-[#2f7fd0] hover:underline"
                  >
                    {m.number} — {m.clientName}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader
          actions={
            <SimActionButton
              variant="primary"
              onClick={() => dispatch({ type: "OPEN_CREATE_MATTER" })}
            >
              Add Matter
            </SimActionButton>
          }
        >
          {label} ({rows.length})
        </PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          <GridHeader>
            <GridCell width={70}>Status</GridCell>
            <GridCell width={80}>Matter #</GridCell>
            <GridCell width={190}>Client</GridCell>
            <GridCell width={90}>Type</GridCell>
            <GridCell width={180}>Other Party</GridCell>
            <GridCell grow>Description</GridCell>
            <GridCell width={140}>Stage</GridCell>
            <GridCell width={110}>Settlement</GridCell>
          </GridHeader>
          {rows.length === 0 ? (
            <EmptyPane>No matters in this folder.</EmptyPane>
          ) : (
            rows.map((m) => (
              <GridRow key={m.id} onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}>
                <GridCell width={70}>
                  <SimTag tone={m.status === "Open" ? "blue" : "gray"}>{m.status}</SimTag>
                </GridCell>
                <GridCell width={80} className="text-[#2f7fd0]">
                  {m.number}
                </GridCell>
                <GridCell width={190}>{m.clientName}</GridCell>
                <GridCell width={90}>{m.type}</GridCell>
                <GridCell width={180}>{m.otherPartyName}</GridCell>
                <GridCell grow>{m.propertyAddress}</GridCell>
                <GridCell width={140}>{m.stage}</GridCell>
                <GridCell width={110}>{formatAuDate(m.settlementDate) || "—"}</GridCell>
              </GridRow>
            ))
          )}
        </div>
        <div className="flex h-[26px] shrink-0 items-center border-t border-[#dfe5ec] bg-[#f7fafc] px-3 text-[11px] text-[#5b6b7d]">
          Click a row to open the matter · {rows.length} items
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

export function ContactsPane() {
  const { state, dispatch } = useSim();
  const [category, setCategory] = useState<string>("All contacts");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = state.contacts.find((c) => c.id === selectedId) ?? null;
  const relatedMatters = selected
    ? state.matters.filter((m) =>
        [m.clientName, m.otherPartyName, m.otherPartySolicitor].some((field) =>
          field.toLowerCase().includes(selected.name.split(" ").slice(-1)[0].toLowerCase()),
        ),
      )
    : [];
  const categories = useMemo(
    () => ["All contacts", ...Array.from(new Set(state.contacts.map((c) => c.category))).sort()],
    [state.contacts],
  );
  const rows = state.contacts.filter(
    (c) => category === "All contacts" || c.category === category,
  );

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[220px] shrink-0 overflow-auto border-r border-[#dfe5ec] bg-white p-2">
        <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
          Contacts
        </span>
        <div className="mt-1 grid">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "flex items-center gap-1.5 rounded-[2px] px-1.5 py-1 text-left text-[12px]",
                category === c ? "bg-[#dcebfa] text-[#22303f]" : "text-[#3c4653] hover:bg-[#f2f7fc]",
              )}
            >
              <Folder className="size-3.5 text-[#e0a93e]" />
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader>
          {category.toUpperCase()} ({rows.length})
        </PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          <GridHeader>
            <GridCell width={44}>Type</GridCell>
            <GridCell width={200}>Name</GridCell>
            <GridCell width={170}>Organisation</GridCell>
            <GridCell width={130}>Risk Assessment</GridCell>
            <GridCell width={130}>Work Phone</GridCell>
            <GridCell width={230}>Email</GridCell>
            <GridCell grow>Address</GridCell>
          </GridHeader>
          {rows.map((c) => (
            <GridRow
              key={c.id}
              selected={selectedId === c.id}
              onClick={() => setSelectedId(c.id)}
              className={cn(c.createdBySim && "bg-[#f2fbf4]")}
            >
              <GridCell width={44}>
                {c.type === "person" ? (
                  <UserRound className="size-3.5 text-[#5b6b7d]" />
                ) : (
                  <Building2 className="size-3.5 text-[#5b6b7d]" />
                )}
              </GridCell>
              <GridCell width={200} className="font-medium">
                {c.name}
              </GridCell>
              <GridCell width={170}>{c.organisation || "—"}</GridCell>
              <GridCell width={130}>
                <SimTag tone={c.riskAssessment === "Complete" ? "green" : "red"}>
                  {c.riskAssessment}
                </SimTag>
              </GridCell>
              <GridCell width={130}>{c.phone}</GridCell>
              <GridCell width={230}>{c.email}</GridCell>
              <GridCell grow>{c.address}</GridCell>
            </GridRow>
          ))}
        </div>
      </div>

      {selected && (
        <aside className="w-[260px] shrink-0 overflow-auto border-l border-[#dfe5ec] bg-white">
          <PaneHeader
            actions={
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-[11px] text-[#5b6b7d] hover:text-[#22303f]"
              >
                Close
              </button>
            }
          >
            Contact details
          </PaneHeader>
          <div className="grid gap-2 p-3 text-[12px]">
            <div className="text-[14px] font-semibold text-[#22303f]">{selected.name}</div>
            {selected.organisation && (
              <div className="text-[#5b6b7d]">{selected.organisation}</div>
            )}
            <div className="flex items-center gap-2">
              <SimTag tone={selected.riskAssessment === "Complete" ? "green" : "red"}>
                {selected.riskAssessment}
              </SimTag>
              <span className="text-[11px] text-[#5b6b7d]">risk assessment</span>
            </div>
            <div className="mt-1 grid gap-1 border-t border-[#eef2f6] pt-2">
              <div>
                <span className="text-[#5b6b7d]">Category: </span>
                {selected.category}
              </div>
              <div>
                <span className="text-[#5b6b7d]">Email: </span>
                {selected.email || "—"}
              </div>
              <div>
                <span className="text-[#5b6b7d]">Phone: </span>
                {selected.phone || "—"}
              </div>
              <div>
                <span className="text-[#5b6b7d]">Address: </span>
                {selected.address || "—"}
              </div>
            </div>
            {relatedMatters.length > 0 && (
              <div className="mt-1 border-t border-[#eef2f6] pt-2">
                <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
                  Related matters
                </span>
                {relatedMatters.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                    className="block w-full truncate py-0.5 text-left text-[#2f7fd0] hover:underline"
                  >
                    {m.number} — {m.type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

const WORK_WEEK = [
  { label: "Monday, 17 August", date: "2026-08-17" },
  { label: "Tuesday, 18 August", date: "2026-08-18" },
  { label: "Wednesday, 19 August", date: "2026-08-19" },
  { label: "Thursday, 20 August", date: "2026-08-20" },
  { label: "Friday, 21 August", date: "2026-08-21" },
];

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function hourLabel(h: number) {
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} 00` : `${h} 00`;
}

export function CalendarPane() {
  const { state } = useSim();
  const [showMine, setShowMine] = useState(true);
  const [showSettlements, setShowSettlements] = useState(true);

  const calendarVisible = (calendar: string) =>
    calendar === "Settlements" ? showSettlements : showMine;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[230px] shrink-0 overflow-auto border-r border-[#dfe5ec] bg-white p-3 text-[12px]">
        <div className="font-semibold text-[#22303f]">August 2026</div>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[11px] text-[#5b6b7d]">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <span key={d} className="font-semibold">
              {d}
            </span>
          ))}
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <span
              key={d}
              className={cn(
                "rounded-sm py-px",
                d === 19 && "bg-[#2f7fd0] font-semibold text-white",
                (d === 17 || d === 18 || d === 20 || d === 21) && "bg-[#dcebfa]",
              )}
            >
              {d}
            </span>
          ))}
        </div>
        <div className="mt-4">
          <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
            My calendar
          </span>
          <SimCheckbox checked={showMine} onChange={setShowMine} label={state.user.name} />
        </div>
        <div className="mt-3">
          <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
            Group calendars
          </span>
          <SimCheckbox
            checked={showSettlements}
            onChange={setShowSettlements}
            label="Settlements"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader>Work week</PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex border-b border-[#dfe5ec] bg-[#eef3f8] text-[11px] font-semibold text-[#4a5768]">
            <div className="w-[56px] shrink-0 border-r border-[#dfe5ec]" />
            {WORK_WEEK.map((d) => (
              <div
                key={d.date}
                className={cn(
                  "flex-1 border-r border-[#dfe5ec] px-2 py-1.5 text-center last:border-r-0",
                  d.date === state.today && "bg-[#dcebfa]",
                )}
              >
                {d.label}
              </div>
            ))}
          </div>
          {HOURS.map((h) => (
            <div key={h} className="flex border-b border-[#eef2f6]">
              <div className="w-[56px] shrink-0 border-r border-[#dfe5ec] px-1 py-2 text-right text-[11px] text-[#8b98a6]">
                {hourLabel(h)}
              </div>
              {WORK_WEEK.map((d) => {
                const dayEvents = state.events.filter((e) => {
                  if (!e.start.startsWith(d.date)) return false;
                  if (!calendarVisible(e.calendar)) return false;
                  const time = e.start.split(" ")[1] ?? "";
                  const ampm = e.start.split(" ")[2] ?? "";
                  let hour = Number(time.split(":")[0]);
                  if (ampm === "PM" && hour !== 12) hour += 12;
                  if (ampm === "AM" && hour === 12) hour = 0;
                  return hour === h;
                });
                return (
                  <div key={d.date} className="min-h-[34px] flex-1 border-r border-[#eef2f6] p-0.5 last:border-r-0">
                    {dayEvents.map((e) => (
                      <div
                        key={e.id}
                        className="mb-0.5 rounded-[2px] border-l-2 border-[#2f7fd0] bg-[#dcebfa] px-1 py-0.5 text-[10px] leading-tight text-[#22303f]"
                      >
                        {e.subject}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Firm-wide tasks                                                     */
/* ------------------------------------------------------------------ */

type TaskView = "todo" | "overdue" | "today" | "week" | "nodate" | "completed";

const TASK_VIEWS: { key: TaskView; label: string }[] = [
  { key: "todo", label: "To Do - All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "nodate", label: "No due date" },
  { key: "completed", label: "Completed" },
];

export function TasksPane() {
  const { state, dispatch } = useSim();
  const [view, setView] = useState<TaskView>("todo");
  const [assignee, setAssignee] = useState<string>(state.user.name);
  const [quick, setQuick] = useState("");

  const forAssignee = useMemo(
    () =>
      assignee === "All staff"
        ? state.tasks
        : state.tasks.filter((t) => t.assignedTo === assignee),
    [state.tasks, assignee],
  );

  const counts = useMemo(() => {
    const open = forAssignee.filter((t) => !t.completedOn);
    return {
      todo: open.length,
      overdue: open.filter((t) => t.dueOn && t.dueOn < state.today).length,
      today: open.filter((t) => t.dueOn === state.today).length,
      week: open.filter((t) => t.dueOn && t.dueOn > state.today && t.dueOn <= "2026-08-23").length,
      nodate: open.filter((t) => !t.dueOn).length,
      completed: forAssignee.filter((t) => t.completedOn).length,
    };
  }, [forAssignee, state.today]);

  const rows = useMemo(() => {
    const open = forAssignee.filter((t) => !t.completedOn);
    switch (view) {
      case "overdue":
        return open.filter((t) => t.dueOn && t.dueOn < state.today);
      case "today":
        return open.filter((t) => t.dueOn === state.today);
      case "week":
        return open.filter((t) => t.dueOn && t.dueOn > state.today && t.dueOn <= "2026-08-23");
      case "nodate":
        return open.filter((t) => !t.dueOn);
      case "completed":
        return forAssignee.filter((t) => t.completedOn);
      default:
        return open;
    }
  }, [forAssignee, state.today, view]);

  const matterLabel = (matterId: string | null) => {
    if (!matterId) return { name: "—", number: "" };
    const m = state.matters.find((x) => x.id === matterId);
    return m ? { name: `${m.clientName} — ${m.type}`, number: m.number } : { name: "—", number: "" };
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[240px] shrink-0 overflow-auto border-r border-[#dfe5ec] bg-white p-3">
        <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
          Assignees
        </span>
        <SimSelect
          className="mt-1 w-full"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        >
          {SIM_STAFF.map((s) => (
            <option key={s}>{s}</option>
          ))}
          <option>All staff</option>
        </SimSelect>

        <span className="mt-4 block text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
          Views
        </span>
        <div className="mt-1 grid">
          {TASK_VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                "flex items-center justify-between rounded-[2px] px-2 py-1 text-left text-[12px]",
                view === v.key ? "bg-[#dcebfa] text-[#22303f]" : "text-[#3c4653] hover:bg-[#f2f7fc]",
              )}
            >
              {v.label}
              <span className="rounded-full bg-[#eef2f6] px-1.5 text-[10px] text-[#5b6b7d]">
                {counts[v.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-end gap-2 border-b border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
          <label className="grid flex-1 gap-1">
            <span className="text-[10px] font-semibold tracking-wide text-[#5b6b7d] uppercase">
              Quick task
            </span>
            <SimInput
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder="Type a task and press Create"
            />
          </label>
          <SimActionButton
            variant="plain"
            disabled={quick.trim().length === 0}
            onClick={() => {
              dispatch({
                type: "ADD_TASK",
                matterId: null,
                name: quick.trim(),
                dueOn: state.today,
                category: "Uncategorized",
                priority: "Medium",
              });
              setQuick("");
            }}
          >
            Create
          </SimActionButton>
        </div>

        <PaneHeader>Tasks ({rows.length})</PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          <GridHeader>
            <GridCell width={34} />
            <GridCell width={90}>Priority</GridCell>
            <GridCell grow>Name</GridCell>
            <GridCell width={130}>Category</GridCell>
            <GridCell width={220}>Matter</GridCell>
            <GridCell width={90}>Matter #</GridCell>
            <GridCell width={110}>Due on</GridCell>
          </GridHeader>
          {rows.length === 0 ? (
            <EmptyPane>Nothing in this view.</EmptyPane>
          ) : (
            rows.map((t) => {
              const overdue = !t.completedOn && t.dueOn !== null && t.dueOn < state.today;
              const info = matterLabel(t.matterId);
              return (
                <GridRow key={t.id}>
                  <GridCell width={34}>
                    <SimCheckbox
                      checked={t.completedOn !== null}
                      onChange={() => dispatch({ type: "TOGGLE_TASK", taskId: t.id })}
                    />
                  </GridCell>
                  <GridCell width={90}>{t.priority}</GridCell>
                  <GridCell grow className={cn(overdue && "font-medium text-[#c8323b]")}>
                    {t.name}
                  </GridCell>
                  <GridCell width={130}>{t.category}</GridCell>
                  <GridCell width={220}>
                    {t.matterId ? (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "OPEN_MATTER", matterId: t.matterId! })}
                        className="truncate text-[#2f7fd0] hover:underline"
                      >
                        {info.name}
                      </button>
                    ) : (
                      "—"
                    )}
                  </GridCell>
                  <GridCell width={90}>{info.number}</GridCell>
                  <GridCell width={110} className={cn(overdue && "font-medium text-[#c8323b]")}>
                    {t.dueOn ? formatAuDate(t.dueOn) : "No due date"}
                  </GridCell>
                </GridRow>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

const ACTIVITY_TYPES: ActivityKind[] = [
  "Document",
  "Email",
  "Memo",
  "Task",
  "Event",
  "Matter Administration",
  "Matter Opened",
];

export function ActivityPane() {
  const { state, dispatch } = useSim();
  const [hiddenTypes, setHiddenTypes] = useState<ActivityKind[]>([]);

  const toggleType = (kind: ActivityKind) =>
    setHiddenTypes((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );

  const visible = useMemo(
    () => state.activities.filter((a) => !hiddenTypes.includes(a.kind)),
    [state.activities, hiddenTypes],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SimActivity[]>();
    for (const a of visible) {
      const day = a.time.split(" ")[0];
      map.set(day, [...(map.get(day) ?? []), a]);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visible]);

  const totalHours = visible.reduce((sum, a) => sum + a.hours, 0);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[230px] shrink-0 overflow-auto border-r border-[#dfe5ec] bg-white p-3">
        <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
          Staff
        </span>
        <SimSelect className="mt-1 w-full" defaultValue={state.user.name}>
          <option>{state.user.name}</option>
        </SimSelect>
        <span className="mt-4 block text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
          Activity types
        </span>
        <div className="mt-1 grid gap-1">
          <SimCheckbox
            checked={hiddenTypes.length === 0}
            onChange={(next) => setHiddenTypes(next ? [] : [...ACTIVITY_TYPES])}
            label="Show all"
          />
          {ACTIVITY_TYPES.map((t) => (
            <SimCheckbox
              key={t}
              checked={!hiddenTypes.includes(t)}
              onChange={() => toggleType(t)}
              label={t}
            />
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader>
          Activity — August 2026 · {totalHours.toFixed(2)} hrs recorded
        </PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          <GridHeader>
            <GridCell width={150}>Type</GridCell>
            <GridCell width={150}>Time</GridCell>
            <GridCell grow>Description</GridCell>
            <GridCell width={70}>Hours</GridCell>
            <GridCell width={100}>Time entry?</GridCell>
          </GridHeader>
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center justify-between border-b border-[#dfe5ec] bg-[#f4f7fa] px-2 py-1 text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
                <span>{formatLongDate(day)}</span>
                <span>
                  ({items.length}) activities · {items.reduce((s, i) => s + i.hours, 0).toFixed(2)} hrs
                </span>
              </div>
              {items.map((a) => (
                <GridRow
                  key={a.id}
                  onClick={
                    a.matterId ? () => dispatch({ type: "OPEN_MATTER", matterId: a.matterId! }) : undefined
                  }
                >
                  <GridCell width={150}>{a.kind}</GridCell>
                  <GridCell width={150}>{a.time.split(" ").slice(1).join(" ")}</GridCell>
                  <GridCell grow>{a.description}</GridCell>
                  <GridCell width={70}>{a.hours.toFixed(2)}</GridCell>
                  <GridCell width={100}>
                    {a.hasTimeEntry ? (
                      <SimTag tone="green">Set</SimTag>
                    ) : (
                      <SimTag tone="gray">Add</SimTag>
                    )}
                  </GridCell>
                </GridRow>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export function ReportsPane() {
  const { state } = useSim();
  const [report, setReport] = useState("Matter - Full List");

  const unbilled = state.matters.reduce((s, m) => s + m.billing.unbilled, 0);
  const unpaid = state.matters.reduce((s, m) => s + m.billing.unpaid, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
        <span className="text-[12px] text-[#3c4653]">Select Report:</span>
        <SimSelect value={report} onChange={(e) => setReport(e.target.value)} className="w-[280px]">
          <option>Matter - Full List</option>
          <option>Unbilled Work in Progress</option>
          <option>Settlements by Month</option>
        </SimSelect>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {report === "Matter - Full List" ? (
          <>
            <GridHeader>
              <GridCell width={90}>Matter #</GridCell>
              <GridCell width={210}>Client</GridCell>
              <GridCell width={100}>Type</GridCell>
              <GridCell width={140}>Stage</GridCell>
              <GridCell width={110}>Settlement</GridCell>
              <GridCell width={110}>Unbilled</GridCell>
              <GridCell grow>Property</GridCell>
            </GridHeader>
            {state.matters.map((m) => (
              <GridRow key={m.id}>
                <GridCell width={90}>{m.number}</GridCell>
                <GridCell width={210}>{m.clientName}</GridCell>
                <GridCell width={100}>{m.type}</GridCell>
                <GridCell width={140}>{m.stage}</GridCell>
                <GridCell width={110}>{formatAuDate(m.settlementDate) || "—"}</GridCell>
                <GridCell width={110}>{formatMoney(m.billing.unbilled)}</GridCell>
                <GridCell grow>{m.propertyAddress}</GridCell>
              </GridRow>
            ))}
          </>
        ) : report === "Unbilled Work in Progress" ? (
          <div className="p-4 text-[12px] text-[#22303f]">
            <div className="mb-3 font-semibold">Work in progress across all open matters</div>
            <div className="grid max-w-[420px] gap-1">
              <div className="flex justify-between border-b border-[#eef2f6] py-1">
                <span>Total unbilled (ex GST)</span>
                <span className="font-semibold">{formatMoney(unbilled)}</span>
              </div>
              <div className="flex justify-between border-b border-[#eef2f6] py-1">
                <span>Total unpaid invoices</span>
                <span className="font-semibold">{formatMoney(unpaid)}</span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyPane>Select a date range to run this report.</EmptyPane>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AML                                                                 */
/* ------------------------------------------------------------------ */

export function AmlPane() {
  const { state, dispatch } = useSim();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader>AML / KYC status by matter</PaneHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <GridHeader>
          <GridCell width={90}>Matter #</GridCell>
          <GridCell width={230}>Client</GridCell>
          <GridCell width={120}>AML / VOI</GridCell>
          <GridCell width={110}>Risk rating</GridCell>
          <GridCell width={110}>Settlement</GridCell>
          <GridCell grow>Property</GridCell>
        </GridHeader>
        {state.matters.map((m) => (
          <GridRow key={m.id} onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}>
            <GridCell width={90} className="text-[#2f7fd0]">
              {m.number}
            </GridCell>
            <GridCell width={230}>{m.clientName}</GridCell>
            <GridCell width={120}>
              <SimTag tone={m.amlComplete ? "green" : "red"}>
                {m.amlComplete ? "Complete" : "Incomplete"}
              </SimTag>
            </GridCell>
            <GridCell width={110}>{m.riskRating ?? "Not assessed"}</GridCell>
            <GridCell width={110}>{formatAuDate(m.settlementDate) || "—"}</GridCell>
            <GridCell grow>{m.propertyAddress}</GridCell>
          </GridRow>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function SearchPane() {
  const { state, dispatch } = useSim();
  const [query, setQuery] = useState(state.nav.searchQuery);

  // Quick Search in the firm bar navigates here carrying its term.
  const [lastNavQuery, setLastNavQuery] = useState(state.nav.searchQuery);
  if (state.nav.searchQuery !== lastNavQuery) {
    setLastNavQuery(state.nav.searchQuery);
    setQuery(state.nav.searchQuery);
  }

  const q = query.trim().toLowerCase();

  const matters: SimMatter[] = q
    ? state.matters.filter((m) =>
        [m.number, m.clientName, m.propertyAddress, m.otherPartyName, m.type]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : [];
  const memos = q
    ? state.memos.filter((m) => `${m.title} ${m.body}`.toLowerCase().includes(q))
    : [];
  const emails = q
    ? state.emails.filter((e) => `${e.subject} ${e.body} ${e.from}`.toLowerCase().includes(q))
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
        <div className="relative w-[420px]">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[#2f7fd0]" />
          <SimInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") dispatch({ type: "SEARCH", query });
            }}
            placeholder="Search matters, memos and emails"
            className="w-full pl-7"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-[12px]">
        {!q ? (
          <EmptyPane>Type a client name, address or matter number to search.</EmptyPane>
        ) : (
          <div className="grid gap-4">
            <section>
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
                Matters ({matters.length})
              </div>
              {matters.length === 0 ? (
                <p className="text-[#8b98a6]">No matching matters.</p>
              ) : (
                matters.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                    className="block w-full border-b border-[#eef2f6] py-1.5 text-left hover:bg-[#f2f7fc]"
                  >
                    <span className="text-[#2f7fd0]">{m.number}</span> — {m.clientName} ·{" "}
                    <span className="text-[#5b6b7d]">{m.propertyAddress}</span>
                  </button>
                ))
              )}
            </section>
            <section>
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
                Memos ({memos.length})
              </div>
              {memos.length === 0 ? (
                <p className="text-[#8b98a6]">No matching memos.</p>
              ) : (
                memos.map((m) => (
                  <div key={m.id} className="border-b border-[#eef2f6] py-1.5">
                    <FileText className="mr-1 inline size-3.5 text-[#5b6b7d]" />
                    {m.title}
                  </div>
                ))
              )}
            </section>
            <section>
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
                Emails ({emails.length})
              </div>
              {emails.length === 0 ? (
                <p className="text-[#8b98a6]">No matching emails.</p>
              ) : (
                emails.map((e) => (
                  <div key={e.id} className="border-b border-[#eef2f6] py-1.5">
                    {e.subject} · <span className="text-[#5b6b7d]">{e.from}</span>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
