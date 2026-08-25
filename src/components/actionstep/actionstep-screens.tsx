"use client";

/**
 * Actionstep screens.
 *
 * The centrepiece is the Steps tab: a matter sits at a workflow step, and the
 * step will not release the matter until its required participant types and
 * data fields are populated. That enforcement is the thing worth practising.
 */

import { useState } from "react";
import {
  ArrowLeft,
  BookUser,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  Filter,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Lock,
  Plus,
  Star,
  StickyNote,
  TriangleAlert,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AS_STAFF } from "@/lib/actionstep/seed";
import {
  formatAuDate,
  formatMoney,
  useActionstep,
  type NewActionDraft,
} from "@/lib/actionstep/store";
import {
  MATTER_TYPES,
  PARTICIPANT_TYPES,
  canLeaveStep,
  currentStep,
  daysInStep,
  stepBlockers,
  stepsFor,
  type AsMatter,
  type AsState,
  type AsTab,
  type MatterStatusFilter,
  type MatterType,
  type ParticipantType,
} from "@/lib/actionstep/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function AsButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
  title?: string;
}) {
  const v = {
    primary: "bg-[#e2622c] text-white hover:bg-[#c9531f] border-[#e2622c]",
    secondary: "bg-white text-[#334155] hover:bg-[#f1f5f9] border-[#cbd5e1]",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded border px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        v,
        className,
      )}
    >
      {children}
    </button>
  );
}

function AsInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "h-8 min-w-0 rounded border border-[#cbd5e1] bg-white px-2.5 text-[12px] text-[#1e293b] outline-none placeholder:text-[#94a3b8] focus:border-[#e2622c] focus:ring-2 focus:ring-[#e2622c]/20",
        className,
      )}
    />
  );
}

function AsSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-8 min-w-0 rounded border border-[#cbd5e1] bg-white px-2 text-[12px] text-[#1e293b] outline-none focus:border-[#e2622c] focus:ring-2 focus:ring-[#e2622c]/20",
        className,
      )}
    >
      {children}
    </select>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] font-semibold text-[#64748b]">{children}</span>;
}

function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded border border-[#e2e8f0] bg-white", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-[#eef2f6] px-3 py-2">
          <span className="text-[12px] font-semibold tracking-wide text-[#334155] uppercase">
            {title}
          </span>
          {actions}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function StarButton({
  matterId,
  starred,
  className,
}: {
  matterId: string;
  starred: boolean;
  className?: string;
}) {
  const { dispatch } = useActionstep();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "TOGGLE_STAR", matterId });
      }}
      aria-label={starred ? "Unstar this matter" : "Star this matter"}
      title={starred ? "Unstar this matter" : "Star this matter"}
      className={cn("shrink-0", className)}
    >
      <Star
        className={cn(
          "size-3.5",
          starred ? "fill-[#e2622c] text-[#e2622c]" : "text-[#cbd5e1] hover:text-[#94a3b8]",
        )}
      />
    </button>
  );
}

/**
 * The Home screen — the landing page, not a menu. Three panels, each backed
 * by real state: matters you've pinned, tasks assigned to you, and matters
 * you've opened recently. Starring a file you're actively working saves the
 * re-searching; unstar it once you're done or the list stops being useful.
 */
export function ActionstepHome() {
  const { state, dispatch } = useActionstep();
  const starred = state.matters.filter((m) => state.starredMatterIds.includes(m.id));
  const myTasks = state.tasks.filter((t) => t.assignedTo === state.user.name && !t.completedOn);

  const recentIds: string[] = [];
  for (const l of [...state.log].reverse()) {
    if (l.type === "nav.matter.open" && l.matterId && !recentIds.includes(l.matterId)) {
      recentIds.push(l.matterId);
      if (recentIds.length >= 5) break;
    }
  }
  const recent = recentIds
    .map((id) => state.matters.find((m) => m.id === id))
    .filter((m): m is AsMatter => !!m);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f1f5f9] p-4">
      <div className="mx-auto grid max-w-[1080px] gap-4">
        <h2 className="text-[17px] font-semibold text-[#0f172a]">Home</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
          <Panel title={`Starred matters (${starred.length})`}>
            {starred.length === 0 ? (
              <p className="p-3 text-[12px] text-[#64748b]">
                Star a matter from its page to pin it here — the three or four files you&apos;re
                actually working on today.
              </p>
            ) : (
              starred.map((m) => (
                <div
                  key={m.id}
                  onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                  className="flex cursor-pointer items-center gap-2 border-b border-[#f1f5f9] px-3 py-2 last:border-b-0 hover:bg-[#f8fafc]"
                >
                  <StarButton matterId={m.id} starred />
                  <span className="min-w-0 flex-1 text-[12px] text-[#0f172a]">{m.name}</span>
                </div>
              ))
            )}
          </Panel>

          <Panel title={`My tasks (${myTasks.length})`}>
            {myTasks.length === 0 ? (
              <p className="p-3 text-[12px] text-[#64748b]">
                Nothing outstanding assigned to you.
              </p>
            ) : (
              myTasks.slice(0, 6).map((t) => {
                const m = state.matters.find((x) => x.id === t.matterId);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2.5 border-b border-[#f1f5f9] px-3 py-2 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => dispatch({ type: "TOGGLE_TASK", taskId: t.id })}
                      className="size-3.5 accent-[#e2622c]"
                    />
                    <span className="min-w-0 flex-1 text-[12px]">
                      <span className="block text-[#0f172a]">{t.name}</span>
                      <span className="block text-[11px] text-[#64748b]">
                        {m?.name} · {t.dueOn ? `due ${formatAuDate(t.dueOn)}` : "no due date"}
                      </span>
                    </span>
                  </div>
                );
              })
            )}
          </Panel>

          <Panel title="Recently opened">
            {recent.length === 0 ? (
              <p className="p-3 text-[12px] text-[#64748b]">
                Matters you open will show up here — the fastest way back to something you had
                open yesterday.
              </p>
            ) : (
              recent.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                  className="flex w-full items-center gap-2 border-b border-[#f1f5f9] px-3 py-2 text-left last:border-b-0 hover:bg-[#f8fafc]"
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[#0f172a]">
                    {m.name}
                  </span>
                </button>
              ))
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

const MATTER_STATUS_OPTIONS: MatterStatusFilter[] = ["All", "Active", "On Hold", "Closed"];

/**
 * The Matters screen — the full list, with Views and Filters. It defaults to
 * Active only, same as a real system, which is exactly why a matter can look
 * like it's vanished when it's really just been filed as Closed.
 */
export function ActionstepMattersList() {
  const { state, dispatch } = useActionstep();
  const filter = state.matterListFilter.status;
  const filtered = state.matters.filter((m) => filter === "All" || m.status === filter);
  const filterActive = filter !== "All";

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f1f5f9] p-4">
      <div className="mx-auto grid max-w-[1080px] gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[17px] font-semibold text-[#0f172a]">Matters</h2>
          <AsButton className="ml-auto" onClick={() => dispatch({ type: "OPEN_CREATE_MATTER" })}>
            <Plus className="size-3.5" />
            New Matter
          </AsButton>
        </div>

        <Panel
          title={`Matters (${filtered.length})`}
          actions={
            <div className="flex items-center gap-2">
              {filterActive && (
                <span
                  title="A status filter is narrowing this list"
                  className="inline-flex items-center gap-1 rounded bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#92400e]"
                >
                  <Filter className="size-3" />1 filter active
                </span>
              )}
              <AsSelect
                value={filter}
                onChange={(e) =>
                  dispatch({
                    type: "SET_MATTER_FILTER",
                    status: e.target.value as MatterStatusFilter,
                  })
                }
              >
                {MATTER_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "All" ? "All statuses" : s}
                  </option>
                ))}
              </AsSelect>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <div className="p-4 text-[12px]">
              <p className="font-semibold text-[#0f172a]">No matters match this filter.</p>
              <p className="mt-1 text-[#64748b]">
                That is not the same as no matters existing — a status filter hides rows just as
                easily as it narrows a search.{" "}
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SET_MATTER_FILTER", status: "All" })}
                  className="font-semibold text-[#e2622c] hover:underline"
                >
                  Clear the filter
                </button>{" "}
                and look again before telling anyone something is missing.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[12px]">
                <thead>
                  <tr className="border-b border-[#eef2f6] text-left text-[11px] font-semibold text-[#64748b]">
                    <th className="px-3 py-2" aria-label="Starred" />
                    <th className="px-3 py-2">Action ID</th>
                    <th className="px-3 py-2">Matter name</th>
                    <th className="px-3 py-2">Matter type</th>
                    <th className="px-3 py-2">Current step</th>
                    <th className="px-3 py-2">Assigned to</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const step = currentStep(state, m);
                    const blocked = !canLeaveStep(m, step);
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#f8fafc]"
                      >
                        <td className="px-3 py-2">
                          <StarButton
                            matterId={m.id}
                            starred={state.starredMatterIds.includes(m.id)}
                          />
                        </td>
                        <td
                          onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                          className="cursor-pointer px-3 py-2 font-semibold text-[#e2622c]"
                        >
                          {m.actionId}
                        </td>
                        <td
                          onClick={() => dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                          className="cursor-pointer px-3 py-2 text-[#0f172a]"
                        >
                          {m.name}
                        </td>
                        <td className="px-3 py-2 text-[#64748b]">{m.matterType}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-[#0f172a]">
                            {step?.name ?? "—"}
                            {blocked && (
                              <span
                                title="This step has outstanding requirements"
                                className="inline-flex items-center gap-0.5 rounded bg-[#fef3c7] px-1.5 py-px text-[10px] font-semibold text-[#92400e]"
                              >
                                <TriangleAlert className="size-2.5" />
                                blocked
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#64748b]">{m.assignedTo}</td>
                        <td className="px-3 py-2 text-[#64748b]">{m.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/**
 * The firm-wide Tasks screen — everything raised across every matter, not
 * just the one you have open. Not part of any file itself; it just collects
 * what every file has raised.
 */
export function ActionstepTasksScreen() {
  const { state, dispatch } = useActionstep();
  const [showCompleted, setShowCompleted] = useState(false);
  const rows = state.tasks.filter((t) => showCompleted || !t.completedOn);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f1f5f9] p-4">
      <div className="mx-auto grid max-w-[1080px] gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[17px] font-semibold text-[#0f172a]">Tasks</h2>
          <label className="ml-auto flex items-center gap-1.5 text-[12px] text-[#64748b]">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="size-3.5 accent-[#e2622c]"
            />
            Show completed
          </label>
        </div>

        <Panel title={`Tasks across every matter (${rows.length})`}>
          {rows.length === 0 ? (
            <p className="p-3 text-[12px] text-[#64748b]">Nothing here.</p>
          ) : (
            rows.map((t) => {
              const m = state.matters.find((x) => x.id === t.matterId);
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-2.5 border-b border-[#f1f5f9] px-3 py-2.5 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={t.completedOn !== null}
                    onChange={() => dispatch({ type: "TOGGLE_TASK", taskId: t.id })}
                    className="size-3.5 accent-[#e2622c]"
                  />
                  <span className="min-w-0 flex-1 text-[12px]">
                    <button
                      type="button"
                      onClick={() => m && dispatch({ type: "OPEN_MATTER", matterId: m.id })}
                      className={cn(
                        "block text-left hover:underline",
                        t.completedOn ? "text-[#94a3b8] line-through" : "text-[#0f172a]",
                      )}
                    >
                      {t.name}
                    </button>
                    <span className="block text-[11px] text-[#64748b]">
                      {m?.name} · {t.assignedTo}
                      {t.dueOn ? ` · due ${formatAuDate(t.dueOn)}` : ""}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </Panel>
      </div>
    </div>
  );
}

type FirmContact = {
  name: string;
  participantType: ParticipantType;
  email: string;
  phone: string;
  matterNames: string[];
};

/** Every party attached to a matter, deduplicated by name — the firm-wide address book. */
function firmContacts(state: AsState): FirmContact[] {
  const byName = new Map<string, FirmContact>();
  for (const m of state.matters) {
    for (const p of m.participants) {
      const key = p.name.toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        if (!existing.matterNames.includes(m.name)) existing.matterNames.push(m.name);
      } else {
        byName.set(key, {
          name: p.name,
          participantType: p.participantType,
          email: p.email,
          phone: p.phone,
          matterNames: [m.name],
        });
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The Contacts screen — every client, other side, agent and lender, in one
 * firm-wide list. When you attach someone to a matter as a party, this is
 * where they come from.
 */
export function ActionstepContactsScreen() {
  const { state } = useActionstep();
  const contacts = firmContacts(state);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f1f5f9] p-4">
      <div className="mx-auto grid max-w-[1080px] gap-4">
        <h2 className="text-[17px] font-semibold text-[#0f172a]">Contacts</h2>

        <Panel title={`Every party attached to a matter (${contacts.length})`}>
          {contacts.length === 0 ? (
            <p className="p-3 text-[12px] text-[#64748b]">No contacts yet.</p>
          ) : (
            contacts.map((c) => (
              <div
                key={c.name}
                className="flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] px-3 py-2.5 last:border-b-0"
              >
                <BookUser className="size-4 shrink-0 text-[#64748b]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium text-[#0f172a]">{c.name}</span>
                  <span className="block text-[11px] text-[#64748b]">
                    {c.email || "no email"} · {c.phone || "no phone"} · on{" "}
                    {c.matterNames.length} matter{c.matterNames.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="rounded bg-[#e2e8f0] px-2 py-0.5 text-[11px] font-semibold text-[#334155]">
                  {c.participantType}
                </span>
              </div>
            ))
          )}
        </Panel>

        <p className="text-[11px] text-[#64748b]">
          This is the version every matter agrees with — when you need someone&apos;s email or
          phone number, it comes from here rather than an old email.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create matter                                                       */
/* ------------------------------------------------------------------ */

const EMPTY: NewActionDraft = {
  name: "",
  matterType: null,
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  assignedTo: "",
};

export function ActionstepCreateMatter() {
  const { dispatch } = useActionstep();
  const [draft, setDraft] = useState<NewActionDraft>(EMPTY);
  const [attempted, setAttempted] = useState(false);

  const set = <K extends keyof NewActionDraft>(k: K, v: NewActionDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const missing: string[] = [];
  if (!draft.name.trim()) missing.push("matter name");
  if (!draft.matterType) missing.push("matter type");
  const valid = missing.length === 0;

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f1f5f9] p-4">
      <div className="mx-auto grid max-w-[680px] gap-4">
        <button
          type="button"
          onClick={() => dispatch({ type: "CLOSE_MATTER" })}
          className="inline-flex w-fit items-center gap-1 text-[12px] text-[#e2622c] hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to matters
        </button>

        <Panel title="New matter">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 p-3">
            <label className="col-span-full grid gap-1">
              <FieldLabel>Matter name</FieldLabel>
              <AsInput
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Ashcroft-Reyes — Purchase of 5/40 Ferndale Road, Epping"
              />
            </label>
            <label className="grid gap-1">
              <FieldLabel>Matter type</FieldLabel>
              <AsSelect
                value={draft.matterType ?? ""}
                onChange={(e) => set("matterType", e.target.value as MatterType)}
              >
                <option value="">Select a matter type…</option>
                {MATTER_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </AsSelect>
            </label>
            <label className="grid gap-1">
              <FieldLabel>Assigned to</FieldLabel>
              <AsSelect
                value={draft.assignedTo}
                onChange={(e) => set("assignedTo", e.target.value)}
              >
                <option value="">—</option>
                {AS_STAFF.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </AsSelect>
            </label>
            <label className="col-span-full grid gap-1">
              <FieldLabel>Client name</FieldLabel>
              <AsInput
                value={draft.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder="Added to the matter as a Client participant"
              />
            </label>
            <label className="grid gap-1">
              <FieldLabel>Client email</FieldLabel>
              <AsInput
                value={draft.clientEmail}
                onChange={(e) => set("clientEmail", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <FieldLabel>Client phone</FieldLabel>
              <AsInput
                value={draft.clientPhone}
                onChange={(e) => set("clientPhone", e.target.value)}
              />
            </label>
            <p className="col-span-full text-[11px] text-[#64748b]">
              The matter type decides which workflow the matter follows. The matter starts at the
              first step of that workflow, and the step&apos;s tasks are raised automatically.
            </p>
          </div>
        </Panel>

        {attempted && !valid && (
          <div className="rounded border border-[#fecaca] bg-[#fef2f2] p-3 text-[12px] text-[#b91c1c]">
            Still missing: {missing.join(", ")}.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <AsButton variant="secondary" onClick={() => dispatch({ type: "CLOSE_MATTER" })}>
            Cancel
          </AsButton>
          <AsButton
            onClick={() => {
              setAttempted(true);
              if (!valid) return;
              dispatch({ type: "CREATE_MATTER", draft });
              setDraft(EMPTY);
              setAttempted(false);
            }}
          >
            Create matter
          </AsButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matter tabs                                                         */
/* ------------------------------------------------------------------ */

function HomeTab({ matter }: { matter: AsMatter }) {
  const { state, dispatch } = useActionstep();
  const step = currentStep(state, matter);
  const blockers = stepBlockers(matter, step);
  const blocked = blockers.missingParticipantTypes.length > 0 || blockers.missingFields.length > 0;
  const notes = state.fileNotes.filter((n) => n.matterId === matter.id);
  const tasks = state.tasks.filter((t) => t.matterId === matter.id && !t.completedOn);
  const fees = state.timeEntries
    .filter((t) => t.matterId === matter.id && t.billable)
    .reduce((sum, t) => sum + t.hours * t.rate, 0);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
      <Panel title="Current step">
        <div className="p-3">
          <div className="text-[14px] font-semibold text-[#0f172a]">{step?.name ?? "—"}</div>
          <p className="mt-1 text-[11px] text-[#64748b]">{step?.description}</p>
          {blocked ? (
            <div className="mt-2 rounded border border-[#fde68a] bg-[#fffbeb] p-2 text-[11px] text-[#92400e]">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <Lock className="size-3" />
                This step cannot be completed yet
              </div>
              {blockers.missingParticipantTypes.length > 0 && (
                <div>Missing participants: {blockers.missingParticipantTypes.join(", ")}</div>
              )}
              {blockers.missingFields.length > 0 && (
                <div>Missing fields: {blockers.missingFields.map((f) => f.label).join(", ")}</div>
              )}
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#15803d]">
              <CircleCheck className="size-3.5" />
              Ready to move to the next step
            </div>
          )}
          <AsButton
            variant="secondary"
            className="mt-2"
            onClick={() => dispatch({ type: "SET_TAB", tab: "steps" })}
          >
            Go to Steps
            <ChevronRight className="size-3.5" />
          </AsButton>
        </div>
      </Panel>

      <Panel title="Matter details">
        <div className="grid gap-1.5 p-3 text-[12px]">
          {[
            ["Action ID", String(matter.actionId)],
            ["Matter type", matter.matterType],
            ["Assigned to", matter.assignedTo],
            ["Opened", formatAuDate(matter.openedAt)],
            ["Status", matter.status],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-[#64748b]">{k}</span>
              <span className="text-right font-medium text-[#0f172a]">{v}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Outstanding fees">
        <div className="p-3">
          <div className="text-[18px] font-semibold text-[#0f172a]">{formatMoney(fees)}</div>
          <p className="text-[11px] text-[#64748b]">Billable time recorded, not yet invoiced.</p>
        </div>
      </Panel>

      <Panel title={`Tasks (${tasks.length})`}>
        {tasks.length === 0 ? (
          <p className="p-3 text-[12px] text-[#64748b]">Nothing outstanding.</p>
        ) : (
          tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 border-b border-[#f1f5f9] px-3 py-2 last:border-b-0 text-[12px]"
            >
              <input
                type="checkbox"
                checked={false}
                onChange={() => dispatch({ type: "TOGGLE_TASK", taskId: t.id })}
                className="size-3.5 accent-[#e2622c]"
              />
              <span className="min-w-0 flex-1 text-[#0f172a]">{t.name}</span>
            </div>
          ))
        )}
      </Panel>

      <Panel title={`File notes (${notes.length})`} className="col-span-full">
        {notes.length === 0 ? (
          <p className="p-3 text-[12px] text-[#64748b]">No file notes yet.</p>
        ) : (
          notes.slice(0, 4).map((n) => (
            <div key={n.id} className="border-b border-[#f1f5f9] px-3 py-2 last:border-b-0">
              <p className="text-[12px] text-[#0f172a]">{n.text}</p>
              <p className="text-[11px] text-[#64748b]">
                {n.author} · {formatAuDate(n.createdAt)}
              </p>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}

function PartiesTab({ matter }: { matter: AsMatter }) {
  const { state, dispatch } = useActionstep();
  const step = currentStep(state, matter);
  const blockers = stepBlockers(matter, step);
  const [name, setName] = useState("");
  const [type, setType] = useState<ParticipantType>("Client");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <div className="grid gap-3">
      {blockers.missingParticipantTypes.length > 0 && (
        <div className="rounded border border-[#fde68a] bg-[#fffbeb] p-3 text-[12px] text-[#92400e]">
          <span className="font-semibold">
            {step?.name} needs these participant types before the matter can move on:
          </span>{" "}
          {blockers.missingParticipantTypes.join(", ")}.
        </div>
      )}

      <Panel title={`Participants (${matter.participants.length})`}>
        {matter.participants.map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] px-3 py-2.5 last:border-b-0",
              p.createdBySim && "bg-[#f0fdf4]",
            )}
          >
            <Users className="size-4 shrink-0 text-[#64748b]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-[#0f172a]">{p.name}</span>
              <span className="block text-[11px] text-[#64748b]">
                {p.email || "no email"} · {p.phone || "no phone"}
              </span>
            </span>
            <span className="rounded bg-[#e2e8f0] px-2 py-0.5 text-[11px] font-semibold text-[#334155]">
              {p.participantType}
            </span>
          </div>
        ))}
      </Panel>

      <Panel title="Add a participant">
        <div className="flex flex-wrap items-end gap-2 p-3">
          <label className="grid min-w-[200px] flex-1 gap-1">
            <FieldLabel>Name</FieldLabel>
            <AsInput value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid min-w-[170px] gap-1">
            <FieldLabel>Participant type</FieldLabel>
            <AsSelect
              value={type}
              onChange={(e) => setType(e.target.value as ParticipantType)}
            >
              {PARTICIPANT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </AsSelect>
          </label>
          <label className="grid w-[180px] gap-1">
            <FieldLabel>Email</FieldLabel>
            <AsInput value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid w-[140px] gap-1">
            <FieldLabel>Phone</FieldLabel>
            <AsInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <AsButton
            disabled={!name.trim()}
            onClick={() => {
              dispatch({
                type: "ADD_PARTICIPANT",
                matterId: matter.id,
                name: name.trim(),
                participantType: type,
                email,
                phone,
              });
              setName("");
              setEmail("");
              setPhone("");
            }}
          >
            <UserPlus className="size-3.5" />
            Add
          </AsButton>
        </div>
      </Panel>
    </div>
  );
}

function StepsTab({ matter }: { matter: AsMatter }) {
  const { state, dispatch } = useActionstep();
  const steps = stepsFor(state, matter);
  const step = currentStep(state, matter);
  const blockers = stepBlockers(matter, step);
  const canMove = canLeaveStep(matter, step);
  const currentIndex = steps.findIndex((s) => s.id === matter.currentStepId);
  const nextStep = steps[currentIndex + 1];

  const lastBlocked = [...state.log]
    .reverse()
    .find((l) => l.type === "step.blocked" && l.matterId === matter.id);
  const lastChange = [...state.log]
    .reverse()
    .find((l) => l.type === "step.change" && l.matterId === matter.id);
  const showBlockedMessage =
    lastBlocked && (!lastChange || lastBlocked.at > lastChange.at) && !canMove;

  return (
    <div className="grid gap-3">
      {/* Step rail */}
      <Panel title="Workflow">
        <div className="flex flex-wrap gap-1 p-3">
          {steps.map((s, i) => {
            const done = i < currentIndex;
            const active = s.id === matter.currentStepId;
            return (
              <span
                key={s.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold",
                  active
                    ? "bg-[#e2622c] text-white"
                    : done
                      ? "bg-[#dcfce7] text-[#166534]"
                      : "bg-[#f1f5f9] text-[#94a3b8]",
                )}
              >
                {done && <Check className="size-3" />}
                {s.name}
              </span>
            );
          })}
        </div>
      </Panel>

      {/* Current step requirements */}
      <Panel title={`Current step — ${step?.name ?? "—"}`}>
        <div className="p-3">
          <p className="text-[12px] text-[#64748b]">{step?.description}</p>

          {showBlockedMessage && (
            <div className="mt-2 rounded border border-[#fecaca] bg-[#fef2f2] p-2.5 text-[12px] text-[#b91c1c]">
              <span className="font-semibold">Step change blocked.</span> Actionstep will not move
              the matter on until this step&apos;s requirements are met.
            </div>
          )}

          <div className="mt-3 grid gap-3">
            <div>
              <FieldLabel>Required participant types</FieldLabel>
              {step && step.requiredParticipantTypes.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {step.requiredParticipantTypes.map((t) => {
                    const present = !blockers.missingParticipantTypes.includes(t);
                    return (
                      <span
                        key={t}
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium",
                          present
                            ? "bg-[#dcfce7] text-[#166534]"
                            : "bg-[#fef3c7] text-[#92400e]",
                        )}
                      >
                        {present ? (
                          <Check className="size-3" />
                        ) : (
                          <TriangleAlert className="size-3" />
                        )}
                        {t}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-[#64748b]">None.</p>
              )}
              {blockers.missingParticipantTypes.length > 0 && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SET_TAB", tab: "parties" })}
                  className="mt-1.5 text-[11px] font-semibold text-[#e2622c] hover:underline"
                >
                  Add the missing participants on the Parties tab →
                </button>
              )}
            </div>

            <div>
              <FieldLabel>Step data fields</FieldLabel>
              {step && step.dataFields.length > 0 ? (
                <div className="mt-1 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
                  {step.dataFields.map((f) => {
                    const value = matter.dataValues[f.key] ?? "";
                    return (
                      <label key={f.key} className="grid gap-1">
                        <span className="text-[11px] text-[#334155]">
                          {f.label}
                          {f.required && <span className="ml-0.5 text-[#e2622c]">*</span>}
                        </span>
                        {f.type === "choice" ? (
                          <AsSelect
                            value={value}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_DATA_FIELD",
                                matterId: matter.id,
                                key: f.key,
                                label: f.label,
                                value: e.target.value,
                              })
                            }
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
                            placeholder={f.type === "money" ? "0.00" : undefined}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_DATA_FIELD",
                                matterId: matter.id,
                                key: f.key,
                                label: f.label,
                                value: e.target.value,
                              })
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-[#64748b]">None.</p>
              )}
            </div>

            {step && step.documents.length > 0 && (
              <div>
                <FieldLabel>Documents expected at this step</FieldLabel>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {step.documents.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded bg-[#f1f5f9] px-2 py-0.5 text-[11px] text-[#334155]"
                    >
                      <FileText className="size-3" />
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#eef2f6] pt-3">
            <AsButton
              disabled={!nextStep}
              title={
                canMove
                  ? undefined
                  : "Complete this step's required participants and fields first"
              }
              onClick={() =>
                nextStep &&
                dispatch({ type: "CHANGE_STEP", matterId: matter.id, stepId: nextStep.id })
              }
            >
              <ListChecks className="size-3.5" />
              {nextStep ? `Change step to ${nextStep.name}` : "Final step"}
            </AsButton>
            {!canMove && (
              <span className="text-[11px] text-[#92400e]">
                Pressing this while requirements are outstanding is refused and recorded.
              </span>
            )}
          </div>
        </div>
      </Panel>

      {/* History */}
      <Panel title="Step history">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead>
              <tr className="border-b border-[#eef2f6] text-left text-[11px] font-semibold text-[#64748b]">
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">Entered</th>
                <th className="px-3 py-2">Exited</th>
                <th className="px-3 py-2">Days in step</th>
              </tr>
            </thead>
            <tbody>
              {matter.stepHistory.map((h) => {
                const s = steps.find((x) => x.id === h.stepId);
                return (
                  <tr key={h.id} className="border-b border-[#f1f5f9] last:border-b-0">
                    <td className="px-3 py-2 text-[#0f172a]">{s?.name ?? h.stepId}</td>
                    <td className="px-3 py-2 text-[#64748b]">{formatAuDate(h.enteredAt)}</td>
                    <td className="px-3 py-2 text-[#64748b]">
                      {h.exitedAt ? formatAuDate(h.exitedAt) : "current"}
                    </td>
                    <td className="px-3 py-2 text-[#0f172a]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3 text-[#94a3b8]" />
                        {daysInStep(h, state.today)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FileNotesTab({ matter }: { matter: AsMatter }) {
  const { state, dispatch } = useActionstep();
  const [text, setText] = useState("");
  const notes = state.fileNotes.filter((n) => n.matterId === matter.id);

  return (
    <div className="grid gap-3">
      <Panel title="Add a file note">
        <div className="grid gap-2 p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What were you told, by whom, and when?"
            className="min-h-[90px] rounded border border-[#cbd5e1] bg-white px-2.5 py-2 text-[12px] text-[#1e293b] outline-none placeholder:text-[#94a3b8] focus:border-[#e2622c] focus:ring-2 focus:ring-[#e2622c]/20"
          />
          <div className="flex justify-end">
            <AsButton
              disabled={!text.trim()}
              onClick={() => {
                dispatch({ type: "ADD_FILE_NOTE", matterId: matter.id, text: text.trim() });
                setText("");
              }}
            >
              <StickyNote className="size-3.5" />
              Save file note
            </AsButton>
          </div>
        </div>
      </Panel>

      <Panel title={`File notes (${notes.length})`}>
        {notes.length === 0 ? (
          <p className="p-3 text-[12px] text-[#64748b]">No file notes yet.</p>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              className={cn(
                "border-b border-[#f1f5f9] px-3 py-2.5 last:border-b-0",
                n.createdBySim && "bg-[#f0fdf4]",
              )}
            >
              <p className="text-[12px] whitespace-pre-wrap text-[#0f172a]">{n.text}</p>
              <p className="mt-0.5 text-[11px] text-[#64748b]">
                {n.author} · {formatAuDate(n.createdAt)}
              </p>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}

function TasksTab({ matter }: { matter: AsMatter }) {
  const { state, dispatch } = useActionstep();
  const steps = stepsFor(state, matter);
  const rows = state.tasks.filter((t) => t.matterId === matter.id);

  return (
    <Panel title={`Tasks (${rows.length})`}>
      {rows.length === 0 ? (
        <p className="p-3 text-[12px] text-[#64748b]">No tasks on this matter.</p>
      ) : (
        rows.map((t) => {
          const from = steps.find((s) => s.id === t.fromStepId);
          return (
            <div
              key={t.id}
              className={cn(
                "flex flex-wrap items-center gap-2.5 border-b border-[#f1f5f9] px-3 py-2.5 last:border-b-0",
                t.createdBySim && "bg-[#f0fdf4]",
              )}
            >
              <input
                type="checkbox"
                checked={t.completedOn !== null}
                onChange={() => dispatch({ type: "TOGGLE_TASK", taskId: t.id })}
                className="size-3.5 accent-[#e2622c]"
              />
              <span className="min-w-0 flex-1 text-[12px]">
                <span
                  className={cn(
                    "block text-[#0f172a]",
                    t.completedOn && "text-[#94a3b8] line-through",
                  )}
                >
                  {t.name}
                </span>
                <span className="block text-[11px] text-[#64748b]">
                  {t.assignedTo}
                  {from ? ` · raised by step: ${from.name}` : ""}
                  {t.dueOn ? ` · due ${formatAuDate(t.dueOn)}` : ""}
                </span>
              </span>
            </div>
          );
        })
      )}
    </Panel>
  );
}

function TimeTab({ matter }: { matter: AsMatter }) {
  const { state, dispatch } = useActionstep();
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("350");
  const rows = state.timeEntries.filter((t) => t.matterId === matter.id);
  const hoursValue = Number(hours.replace(/[^0-9.]/g, ""));
  const rateValue = Number(rate.replace(/[^0-9.]/g, ""));

  return (
    <div className="grid gap-3">
      <Panel title="Record time">
        <div className="flex flex-wrap items-end gap-2 p-3">
          <label className="grid min-w-[220px] flex-1 gap-1">
            <FieldLabel>Description</FieldLabel>
            <AsInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you do?"
            />
          </label>
          <label className="grid w-[100px] gap-1">
            <FieldLabel>Hours</FieldLabel>
            <AsInput
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0.00"
              className="text-right"
            />
          </label>
          <label className="grid w-[110px] gap-1">
            <FieldLabel>Rate</FieldLabel>
            <AsInput
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="text-right"
            />
          </label>
          <label className="grid w-[110px] gap-1">
            <FieldLabel>Amount</FieldLabel>
            <AsInput value={formatMoney(hoursValue * rateValue || 0)} readOnly className="text-right" />
          </label>
          <AsButton
            disabled={!description.trim() || !(hoursValue > 0)}
            onClick={() => {
              dispatch({
                type: "ADD_TIME_ENTRY",
                matterId: matter.id,
                description: description.trim(),
                hours: hoursValue,
                rate: rateValue,
                billable: true,
              });
              setDescription("");
              setHours("");
            }}
          >
            <Plus className="size-3.5" />
            Add
          </AsButton>
        </div>
        <p className="px-3 pb-3 text-[11px] text-[#64748b]">
          Time is recorded in decimal hours — 18 minutes is 0.30.
        </p>
      </Panel>

      <Panel title={`Time entries (${rows.length})`}>
        {rows.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] px-3 py-2 last:border-b-0 text-[12px]",
              t.createdBySim && "bg-[#f0fdf4]",
            )}
          >
            <span className="w-[80px] shrink-0 text-[#64748b]">{formatAuDate(t.date)}</span>
            <span className="min-w-0 flex-1 text-[#0f172a]">{t.description}</span>
            <span className="text-[#64748b]">{t.hours.toFixed(2)} hrs</span>
            <span className="font-semibold text-[#0f172a]">
              {formatMoney(t.hours * t.rate)}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matter shell                                                        */
/* ------------------------------------------------------------------ */

const TABS: { key: AsTab; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "Home", icon: LayoutDashboard },
  { key: "parties", label: "Parties", icon: Users },
  { key: "steps", label: "Steps", icon: GitBranch },
  { key: "filenotes", label: "File Notes", icon: StickyNote },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "time", label: "Time", icon: Clock },
];

export function ActionstepMatterScreen() {
  const { state, dispatch, matter } = useActionstep();
  if (!matter) return null;
  const step = currentStep(state, matter);
  const tab = state.nav.tab;
  const starred = state.starredMatterIds.includes(matter.id);
  const openHistory = matter.stepHistory.find((h) => h.exitedAt === null);
  const daysHere = openHistory ? daysInStep(openHistory, state.today) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f1f5f9]">
      <div className="shrink-0 bg-[#1e293b] px-4 py-3 text-white">
        <button
          type="button"
          onClick={() => dispatch({ type: "CLOSE_MATTER" })}
          className="mb-2 inline-flex items-center gap-1 text-[12px] text-white/70 hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Matters
        </button>
        <div className="flex flex-wrap items-start gap-3">
          <StarButton matterId={matter.id} starred={starred} className="mt-1" />
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">{matter.name}</div>
            <div className="text-[12px] text-white/65">
              Action {matter.actionId} · {matter.matterType} · assigned to {matter.assignedTo}
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded bg-[#e2622c] px-2.5 py-1 text-[11px] font-semibold">
            {step?.name ?? "—"}
            {openHistory && (
              <span
                title="Days at this step — worth a glance, and worth mentioning if it's a lot"
                className="inline-flex items-center gap-0.5 rounded-full bg-black/20 px-1.5 py-px"
              >
                <Clock className="size-2.5" />
                {daysHere}d
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 gap-0 overflow-x-auto border-b border-[#e2e8f0] bg-white px-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => dispatch({ type: "SET_TAB", tab: t.key })}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[12px] font-semibold transition-colors",
              tab === t.key
                ? "border-[#e2622c] text-[#0f172a]"
                : "border-transparent text-[#64748b] hover:text-[#0f172a]",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-[980px]">
          {tab === "home" && <HomeTab matter={matter} />}
          {tab === "parties" && <PartiesTab matter={matter} />}
          {tab === "steps" && <StepsTab matter={matter} />}
          {tab === "filenotes" && <FileNotesTab matter={matter} />}
          {tab === "tasks" && <TasksTab matter={matter} />}
          {tab === "time" && <TimeTab matter={matter} />}
        </div>
      </div>
    </div>
  );
}
