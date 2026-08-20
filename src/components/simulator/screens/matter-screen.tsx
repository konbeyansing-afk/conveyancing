"use client";

/** The matter window: dark header, tab strip, stage rail and per-tab bodies. */

import { useEffect, useRef, useState } from "react";
import {
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  DollarSign,
  FileDown,
  FileText,
  FolderOpen,
  Import,
  Mail,
  Paperclip,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  ListChecks,
  ScanLine,
  Send,
  Sparkles,
  StickyNote,
  Tag,
  UserRoundPlus,
  X,
} from "lucide-react";
import { formatAuDate, formatAuDateTime, formatMoney, useSim } from "@/lib/simulator/store";
import { MATTER_STAGES, type MatterStage, type MatterTab } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";
import { WindowTitleBar } from "../chrome/window-chrome";
import {
  EmptyPane,
  GridCell,
  GridHeader,
  GridRow,
  PaneHeader,
  RibbonButton,
  RibbonDivider,
  SimActionButton,
  SimCheckbox,
  SimFieldLabel,
  SimInput,
  SimTag,
  SimTextarea,
} from "../sim-primitives";
import { ApplyWorkflowDialog } from "../apply-workflow-dialog";
import {
  MatterDetailDialog,
  type MatterDetailSection,
} from "../matter-detail-dialogs";
import {
  EmailComposeDialog,
  NewDocumentDialog,
  PhoneMessageDialog,
} from "../ribbon-dialogs";
import { DisbursementsGrid, TimeFeesGrid } from "../time-entry-forms";

const MATTER_TABS: { key: MatterTab; label: string }[] = [
  { key: "file", label: "File" },
  { key: "matter", label: "Matter" },
  { key: "emails", label: "Emails" },
  { key: "memos", label: "Memos" },
  { key: "events", label: "Events" },
  { key: "tasks", label: "Tasks" },
  { key: "trisearch", label: "triSearch" },
  { key: "messages", label: "Messages" },
  { key: "activity", label: "Activity" },
  { key: "time", label: "Time & Disbursements" },
];

/* ------------------------------------------------------------------ */
/* Header + tab strip                                                  */
/* ------------------------------------------------------------------ */

function MatterHeader() {
  const { state, dispatch, matter } = useSim();
  if (!matter) return null;

  return (
    <div className="shrink-0 bg-[#46566c] text-white">
      <WindowTitleBar title="" dark />
      <div className="flex items-start gap-3 px-4 pb-2">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-white/40">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] leading-tight font-semibold">{matter.clientName}</div>
          <div className="truncate text-[12px] text-white/75">
            {matter.number} - {matter.type} - {matter.otherPartyName} - {matter.propertyAddress}
            {matter.titleReference && ` | ${matter.titleReference}`}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <UserRoundPlus className="size-3.5 text-white/60" />
            <SimTag tone="blue">{matter.status}</SimTag>
            <Tag className="size-3.5 text-white/60" />
            {matter.createdBySim && <SimTag tone="green">Created by you</SimTag>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "CLOSE_MATTER" })}
          className="mt-1 flex shrink-0 items-center gap-1 rounded border border-white/30 px-2 py-1 text-[11px] text-white/85 hover:bg-white/10"
        >
          <X className="size-3.5" />
          Close matter
        </button>
      </div>

      <div className="flex items-end gap-0 overflow-x-auto px-2">
        {MATTER_TABS.map((t) => {
          const active = state.nav.matterTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => dispatch({ type: "MATTER_TAB", tab: t.key })}
              className={cn(
                "shrink-0 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition-colors",
                active ? "bg-white text-[#22303f]" : "text-white/75 hover:bg-white/10",
              )}
            >
              {t.label}
            </button>
          );
        })}
        <span
          title="Archie — the live system's AI assistant isn't simulated; see the Archie panel on the Matter tab"
          className="ml-2 shrink-0 cursor-not-allowed rounded-[2px] bg-[#e8862e] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase opacity-60"
        >
          Archie ✦
        </span>
      </div>
    </div>
  );
}

/** Reasons shown on hover for matter controls outside the simulation. */
const NOT_SIMULATED = {
  scan: "there's no scanner attached to the simulator",
  print: "printing isn't simulated",
  export: "exporting isn't simulated",
  timeFinder: "searches real recorded time across the firm",
};

function MatterRibbon({ onOpenDialog }: { onOpenDialog: (d: MatterRibbonDialog) => void }) {
  const { state, dispatch } = useSim();
  const tab = state.nav.matterTab;

  const newDocument = (label: string, dialog: MatterRibbonDialog) => (
    <RibbonButton
      icon={label === "Import" ? Import : FileText}
      label={label}
      tone={label === "Import" ? "green" : "blue"}
      onClick={() => onOpenDialog(dialog)}
    />
  );

  const common = (
    <>
      {newDocument("New Document", "document")}
      <RibbonButton icon={StickyNote} label="Memo" tone="blue" onClick={() => dispatch({ type: "MATTER_TAB", tab: "memos" })} />
      <RibbonButton icon={Mail} label="Email" tone="blue" onClick={() => dispatch({ type: "MATTER_TAB", tab: "emails" })} />
      {newDocument("Import", "import")}
      <RibbonButton icon={ScanLine} label="Scan" tone="green" unavailable={NOT_SIMULATED.scan} />
      <RibbonDivider />
      <RibbonButton icon={CalendarPlus} label="Event" tone="purple" onClick={() => dispatch({ type: "MATTER_TAB", tab: "events" })} />
      <RibbonButton icon={ClipboardList} label="Task" tone="purple" onClick={() => dispatch({ type: "MATTER_TAB", tab: "tasks" })} />
      <RibbonButton icon={Phone} label="Phone Message" tone="red" onClick={() => onOpenDialog("phone")} />
      <RibbonDivider />
      <RibbonButton icon={DollarSign} label="Billing" tone="green" onClick={() => dispatch({ type: "MATTER_TAB", tab: "time" })} />
      <RibbonButton icon={Clock} label="Time Finder" tone="red" unavailable={NOT_SIMULATED.timeFinder} />
    </>
  );

  const byTab: Partial<Record<MatterTab, React.ReactNode>> = {
    emails: (
      <>
        {newDocument("Letter", "document")}
        <RibbonButton icon={StickyNote} label="Memo" tone="blue" onClick={() => dispatch({ type: "MATTER_TAB", tab: "memos" })} />
        <RibbonButton icon={Mail} label="Email" tone="blue" onClick={() => onOpenDialog("email")} />
        {newDocument("Import", "import")}
      </>
    ),
    memos: (
      <>
        {newDocument("Letter", "document")}
        <RibbonButton icon={StickyNote} label="Memo" tone="blue" onClick={() => onOpenDialog("memo")} />
        <RibbonButton icon={Printer} label="Print" tone="blue" unavailable={NOT_SIMULATED.print} />
      </>
    ),
    events: (
      <RibbonButton
        icon={CalendarPlus}
        label="Event"
        tone="purple"
        onClick={() => onOpenDialog("focus-form")}
      />
    ),
    tasks: (
      <>
        <RibbonButton
          icon={ClipboardList}
          label="Task"
          tone="purple"
          onClick={() => onOpenDialog("focus-form")}
        />
        <RibbonButton icon={Phone} label="Phone Message" tone="red" onClick={() => onOpenDialog("phone")} />
        <RibbonDivider />
        <RibbonButton
          icon={ListChecks}
          label="Apply Workflow"
          tone="green"
          onClick={() => onOpenDialog("workflow")}
        />
      </>
    ),
    messages: (
      <RibbonButton
        icon={RefreshCw}
        label="Refresh"
        tone="blue"
        onClick={() => dispatch({ type: "MATTER_TAB", tab: "messages" })}
      />
    ),
    time: (
      <>
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
        <RibbonButton icon={Printer} label="Print" tone="blue" unavailable={NOT_SIMULATED.print} />
        <RibbonButton icon={FileDown} label="Export" tone="blue" unavailable={NOT_SIMULATED.export} />
      </>
    ),
    activity: (
      <>
        <RibbonButton
          icon={CalendarPlus}
          label="Event"
          tone="purple"
          onClick={() => dispatch({ type: "MATTER_TAB", tab: "events" })}
        />
        <RibbonButton icon={Printer} label="Print" tone="blue" unavailable={NOT_SIMULATED.print} />
        <RibbonButton icon={FileDown} label="Export" tone="blue" unavailable={NOT_SIMULATED.export} />
      </>
    ),
  };

  return (
    <div className="flex h-[74px] shrink-0 items-stretch border-b border-[#dfe5ec] bg-white px-2">
      {byTab[tab] ?? common}
    </div>
  );
}

function StageRail() {
  const { dispatch, matter } = useSim();
  const [open, setOpen] = useState(false);
  if (!matter) return null;
  const activeIndex = MATTER_STAGES.indexOf(matter.stage);

  return (
    <div className="relative flex shrink-0 items-stretch border-b border-[#dfe5ec] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-[110px] shrink-0 items-center justify-center gap-1 border-r border-[#dfe5ec] bg-[#f4f7fa] text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase"
      >
        Stages
        <ChevronDown className="size-3.5" />
      </button>
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {MATTER_STAGES.map((s, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <button
              key={s}
              type="button"
              onClick={() => dispatch({ type: "SET_STAGE", matterId: matter.id, stage: s })}
              className={cn(
                "relative shrink-0 px-5 py-2.5 text-[11px] font-semibold tracking-wide uppercase transition-colors",
                isActive
                  ? "bg-[#2f7fd0] text-white"
                  : isPast
                    ? "bg-[#e8eef4] text-[#5b6b7d]"
                    : "bg-white text-[#8b98a6] hover:bg-[#f2f7fc]",
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="absolute top-full left-0 z-20 w-[240px] border border-[#dfe5ec] bg-white p-2 shadow-lg">
          <p className="mb-1 text-[11px] text-[#5b6b7d]">
            Move the matter to a stage. Stages drive which tasks and documents the firm expects to
            see on the file.
          </p>
          {MATTER_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                dispatch({ type: "SET_STAGE", matterId: matter.id, stage: s as MatterStage });
                setOpen(false);
              }}
              className="block w-full rounded-[2px] px-2 py-1 text-left text-[12px] hover:bg-[#f2f7fc]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matter tab                                                          */
/* ------------------------------------------------------------------ */

function DetailRow({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: React.ReactNode;
  onOpen: () => void;
}) {
  // Smokeball opens these on double-click; single click works here too, since
  // the chevron already advertises the row as openable.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      title={`Open ${label}`}
      className="flex cursor-pointer items-start gap-3 border-b border-[#eef2f6] px-3 py-2 text-[12px] last:border-b-0 hover:bg-[#eaf3fc]"
    >
      <span className="w-[130px] shrink-0 text-[#5b6b7d]">{label}</span>
      <span className="min-w-0 flex-1 text-[#22303f]">{value}</span>
      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-[#7a97b5]" />
    </div>
  );
}

function WidgetsPanel() {
  const { state, dispatch, matter } = useSim();
  const [nextStep, setNextStep] = useState("");
  const [panelTab, setPanelTab] = useState<"archie" | "widgets" | "timeline">("widgets");
  if (!matter) return null;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#dfe5ec] bg-white">
      <div className="flex shrink-0 border-b border-[#dfe5ec]">
        {(
          [
            { key: "archie", label: "Archie ✦" },
            { key: "widgets", label: "Widgets" },
            { key: "timeline", label: "Timeline" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPanelTab(t.key)}
            className={cn(
              "flex-1 py-1.5 text-[11px] font-semibold tracking-wide uppercase",
              panelTab === t.key
                ? "border-b-2 border-[#2f7fd0] text-[#22303f]"
                : "text-[#5b6b7d] hover:text-[#22303f]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {panelTab === "widgets" && (
          <>
            <PaneHeader>Billing</PaneHeader>
            <div className="grid gap-1 p-3 text-[12px]">
              {[
                { label: "Trust Balance", value: matter.billing.trustBalance, warn: true },
                { label: "Unbilled", value: matter.billing.unbilled },
                { label: "Unbilled (inc. GST)", value: matter.billing.unbilledIncGst },
                { label: "Unpaid", value: matter.billing.unpaid },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[#3c4653]">{row.label}</span>
                  <span className="font-semibold text-[#2f7fd0]">{formatMoney(row.value)}</span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => dispatch({ type: "MATTER_TAB", tab: "time" })}
                className="mt-1 text-left text-[11px] text-[#2f7fd0] hover:underline"
              >
                View matter in triConvey Billing
              </button>
            </div>

            <PaneHeader>Next step</PaneHeader>
            <div className="p-3">
              {matter.nextStep && (
                <div className="mb-2 rounded-[2px] bg-[#f2f7fc] p-2 text-[12px] text-[#22303f]">
                  <div className="font-medium">{matter.nextStep}</div>
                  <div className="text-[11px] text-[#5b6b7d]">
                    Due {formatAuDate(matter.nextStepDate)}
                  </div>
                </div>
              )}
              <SimTextarea
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="What happens next on this file?"
                className="min-h-[56px]"
              />
              <div className="mt-1.5 flex items-center gap-2">
                <SimInput value={formatAuDate(state.today)} readOnly className="w-[100px]" />
                <SimInput value={state.user.name} readOnly className="min-w-0 flex-1" />
              </div>
              <div className="mt-1.5 flex justify-end gap-2">
                <SimActionButton variant="plain" onClick={() => setNextStep("")}>
                  Cancel
                </SimActionButton>
                <SimActionButton
                  variant="primary"
                  disabled={nextStep.trim().length === 0}
                  onClick={() => {
                    dispatch({
                      type: "SET_NEXT_STEP",
                      matterId: matter.id,
                      nextStep: nextStep.trim(),
                      date: state.today,
                    });
                    setNextStep("");
                  }}
                >
                  Save
                </SimActionButton>
              </div>
            </div>

            <PaneHeader>Contact details</PaneHeader>
            <div className="grid gap-1 p-3 text-[12px]">
              <div className="font-medium text-[#22303f]">{matter.clientName}</div>
              <div className="text-[#5b6b7d]">{matter.clientEmail}</div>
              <div className="text-[#5b6b7d]">{matter.clientPhone}</div>
              <div className="mt-2 font-medium text-[#22303f]">Other side</div>
              <div className="text-[#5b6b7d]">{matter.otherPartySolicitor}</div>
              {matter.otherPartySolicitorContact && (
                <div className="text-[#5b6b7d]">Contact: {matter.otherPartySolicitorContact}</div>
              )}
            </div>
          </>
        )}

        {panelTab === "timeline" && (
          <div className="p-3">
            {state.activities
              .filter((a) => a.matterId === matter.id)
              .map((a) => (
                <div key={a.id} className="border-b border-[#eef2f6] py-2 text-[12px] last:border-b-0">
                  <div className="text-[#22303f]">{a.description}</div>
                  <div className="text-[11px] text-[#5b6b7d]">
                    {a.kind} · {formatAuDateTime(a.time)}
                  </div>
                </div>
              ))}
          </div>
        )}

        {panelTab === "archie" && (
          <div className="p-4 text-[12px] text-[#5b6b7d]">
            <Sparkles className="mb-2 size-5 text-[#e8862e]" />
            The live system&apos;s AI assistant sits here. It is not simulated — this panel exists so
            the layout matches what you will see at work.
          </div>
        )}
      </div>
    </aside>
  );
}

const FILE_TABS = ["All Files", "Favourites", "Documents", "Messages", "Emails", "triSearch"] as const;
type FileTab = (typeof FILE_TABS)[number];

function DocumentsBrowser() {
  const { state, dispatch, matter } = useSim();
  const [tab, setTab] = useState<FileTab>("Documents");
  if (!matter) return null;

  const docs = state.documents.filter((d) => d.matterId === matter.id);
  const matterEmails = state.emails.filter((e) => e.matterId === matter.id);
  const matterMessages = state.messages.filter((m) => m.matterId === matter.id);

  // Each tab is a different view over the file, the way the real browser works.
  const visible =
    tab === "Documents" || tab === "All Files"
      ? docs
      : tab === "Favourites"
        ? docs.filter((d) => d.kind === "pdf")
        : [];
  const folders = visible.filter((d) => d.kind === "folder");
  const files = visible.filter((d) => d.kind !== "folder");

  return (
    <div className="flex min-h-[210px] shrink-0 flex-col border-t border-[#dfe5ec] bg-white">
      <div className="flex shrink-0 items-center gap-0 border-b border-[#dfe5ec] bg-[#f4f7fa] px-1">
        {FILE_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase",
              tab === t ? "border border-b-0 border-[#dfe5ec] bg-white text-[#22303f]" : "text-[#5b6b7d]",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[#eef2f6] px-3 py-1 text-[12px] text-[#3c4653]">
        <FolderOpen className="size-3.5 text-[#e0a93e]" />
        {tab}
        <ChevronRight className="size-3.5 text-[#a9bcd0]" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "Emails" ? (
          <>
            <GridHeader>
              <GridCell width={90}>Direction</GridCell>
              <GridCell width={220}>From</GridCell>
              <GridCell grow>Subject</GridCell>
              <GridCell width={150}>Date</GridCell>
            </GridHeader>
            {matterEmails.length === 0 ? (
              <EmptyPane>No emails on this matter.</EmptyPane>
            ) : (
              matterEmails.map((e) => (
                <GridRow key={e.id} onClick={() => dispatch({ type: "MATTER_TAB", tab: "emails" })}>
                  <GridCell width={90}>{e.direction}</GridCell>
                  <GridCell width={220}>{e.from}</GridCell>
                  <GridCell grow>{e.subject}</GridCell>
                  <GridCell width={150}>{formatAuDateTime(e.date)}</GridCell>
                </GridRow>
              ))
            )}
          </>
        ) : tab === "Messages" ? (
          <>
            <GridHeader>
              <GridCell width={180}>From</GridCell>
              <GridCell grow>Message</GridCell>
              <GridCell width={150}>Sent</GridCell>
            </GridHeader>
            {matterMessages.length === 0 ? (
              <EmptyPane>No internal messages on this matter.</EmptyPane>
            ) : (
              matterMessages.map((m) => (
                <GridRow key={m.id} onClick={() => dispatch({ type: "MATTER_TAB", tab: "messages" })}>
                  <GridCell width={180}>{m.from}</GridCell>
                  <GridCell grow>{m.body}</GridCell>
                  <GridCell width={150}>{formatAuDateTime(m.sentAt)}</GridCell>
                </GridRow>
              ))
            )}
          </>
        ) : tab === "triSearch" ? (
          <EmptyPane>
            Search orders and AML results live on the triSearch tab above.
          </EmptyPane>
        ) : (
          <>
            <GridHeader>
              <GridCell grow>Name</GridCell>
              <GridCell width={150}>From</GridCell>
              <GridCell width={150}>To</GridCell>
              <GridCell width={110}>Date modified</GridCell>
              <GridCell width={80}>Size</GridCell>
              <GridCell width={60}>Staff</GridCell>
            </GridHeader>
            {visible.length === 0 ? (
              <EmptyPane>Nothing in this view.</EmptyPane>
            ) : (
              [...folders, ...files].map((d) => (
                <GridRow key={d.id}>
                  <GridCell grow>
                    <span className="flex items-center gap-1.5">
                      {d.kind === "folder" ? (
                        <FolderOpen className="size-3.5 shrink-0 text-[#e0a93e]" />
                      ) : (
                        <Paperclip className="size-3.5 shrink-0 text-[#c8323b]" />
                      )}
                      <span className="truncate">{d.name}</span>
                    </span>
                  </GridCell>
                  <GridCell width={150}>{d.from || "—"}</GridCell>
                  <GridCell width={150}>{d.to || "—"}</GridCell>
                  <GridCell width={110}>{formatAuDate(d.dateModified)}</GridCell>
                  <GridCell width={80}>{d.sizeLabel || "—"}</GridCell>
                  <GridCell width={60}>{d.staffInitials}</GridCell>
                </GridRow>
              ))
            )}
          </>
        )}
      </div>
      <div className="flex h-[24px] shrink-0 items-center border-t border-[#dfe5ec] bg-[#f7fafc] px-3 text-[11px] text-[#5b6b7d]">
        {tab === "Emails"
          ? `${matterEmails.length} emails`
          : tab === "Messages"
            ? `${matterMessages.length} messages`
            : `${files.length} files · ${folders.length} folders`}
      </div>
    </div>
  );
}

function MatterDetailsTab() {
  const { matter } = useSim();
  const [openSection, setOpenSection] = useState<MatterDetailSection | null>(null);
  if (!matter) return null;

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">
          <PaneHeader>Matter details</PaneHeader>
          <DetailRow
            label="Info"
            onOpen={() => setOpenSection("info")}
            value={
              <>
                {matter.number} — {matter.feeEarnerInitials}/{matter.assistantInitials}
                {matter.reLine && (
                  <div className="text-[11px] text-[#5b6b7d]">Re: {matter.reLine}</div>
                )}
              </>
            }
          />
          <DetailRow
            label={matter.type === "Sale" ? "Vendor" : "Purchaser"}
            onOpen={() => setOpenSection("client")}
            value={
              <span className="flex flex-wrap items-center gap-2">
                {matter.clientName}
                <SimTag tone={matter.amlComplete ? "green" : "red"}>
                  {matter.amlComplete ? "AML & VOI complete" : "AML & VOI incomplete"}
                </SimTag>
              </span>
            }
          />
          <DetailRow label="Matter Type"
            onOpen={() => setOpenSection("matter-type")} value={matter.type} />
          <DetailRow label="Other Party"
            onOpen={() => setOpenSection("other-party")} value={matter.otherPartyName} />
          <DetailRow
            label="Solicitor"
            onOpen={() => setOpenSection("solicitor")}
            value={
              <>
                {matter.otherPartySolicitor}
                {matter.otherPartySolicitorContact && (
                  <div className="text-[11px] text-[#5b6b7d]">
                    Contact {matter.otherPartySolicitorContact}
                  </div>
                )}
              </>
            }
          />
          <DetailRow label="Property Details"
            onOpen={() => setOpenSection("property")} value={matter.propertyAddress} />
          <DetailRow
            label="Conveyancing Details"
            onOpen={() => setOpenSection("conveyancing")}
            value={
              <>
                Settlement:{" "}
                <span className="font-medium">{formatAuDate(matter.settlementDate) || "Not set"}</span>
                {matter.purchasePrice !== null && (
                  <> &nbsp;·&nbsp; Price: {formatMoney(matter.purchasePrice)}</>
                )}
              </>
            }
          />
          <DetailRow label="Title Reference"
            onOpen={() => setOpenSection("title")} value={matter.titleReference || "Not recorded"} />
          <DetailRow label="Risk Rating"
            onOpen={() => setOpenSection("risk")} value={matter.riskRating ?? "Not assessed"} />
          <DetailRow
            label="Staff"
            onOpen={() => setOpenSection("staff")}
            value={
              <>
                Person Responsible: {matter.personResponsible ?? "—"}
                <div className="text-[11px] text-[#5b6b7d]">
                  Person/s Assisting: {matter.personAssisting ?? "—"}
                  {matter.introducer ? ` · Introducer: ${matter.introducer}` : ""}
                </div>
              </>
            }
          />
          <DetailRow
            label="Referral"
            onOpen={() => setOpenSection("referral")}
            value={
              matter.referralType
                ? `${matter.referralType}${matter.referrer ? ` — ${matter.referrer}` : ""}`
                : "Not recorded"
            }
          />
          <DetailRow
            label="Billing"
            onOpen={() => setOpenSection("billing")}
            value={
              <>
                {matter.billingType ?? "Not set"}
                {matter.feeEstimate ? ` — ${formatMoney(matter.feeEstimate)}` : ""}
                <div className="text-[11px] text-[#5b6b7d]">
                  Debtor: {matter.debtor ?? matter.clientName}
                  {matter.billingFrequency ? ` · ${matter.billingFrequency}` : ""}
                </div>
              </>
            }
          />
          <DetailRow label="Stage"
            onOpen={() => setOpenSection("stage")} value={matter.stage} />
        </div>
        <DocumentsBrowser />
      </div>
      <WidgetsPanel />
      {openSection && (
        <MatterDetailDialog section={openSection} onClose={() => setOpenSection(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Emails / Memos / Events / Tasks / Messages / Activity tabs          */
/* ------------------------------------------------------------------ */

function EmailsTab() {
  const { state, matter } = useSim();
  const [folder, setFolder] = useState<"Received" | "Sent">("Received");
  const [selected, setSelected] = useState<string | null>(null);
  if (!matter) return null;
  const rows = state.emails.filter((e) => e.matterId === matter.id && e.direction === folder);
  const email = rows.find((e) => e.id === selected) ?? null;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[190px] shrink-0 border-r border-[#dfe5ec] bg-white p-2">
        <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
          Emails
        </span>
        {(["Received", "Sent"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFolder(f);
              setSelected(null);
            }}
            className={cn(
              "mt-1 flex w-full items-center gap-1.5 rounded-[2px] px-2 py-1 text-left text-[12px]",
              folder === f ? "bg-[#dcebfa] text-[#22303f]" : "text-[#3c4653] hover:bg-[#f2f7fc]",
            )}
          >
            <Mail className="size-3.5 text-[#e0a93e]" />
            {f}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader>
          {folder} emails ({rows.length})
        </PaneHeader>
        <div className="max-h-[45%] min-h-[120px] overflow-auto">
          <GridHeader>
            <GridCell width={230}>From</GridCell>
            <GridCell width={150}>To</GridCell>
            <GridCell grow>Subject</GridCell>
            <GridCell width={150}>Date</GridCell>
          </GridHeader>
          {rows.length === 0 ? (
            <EmptyPane>Nothing in this folder.</EmptyPane>
          ) : (
            rows.map((e) => (
              <GridRow key={e.id} selected={selected === e.id} onClick={() => setSelected(e.id)}>
                <GridCell width={230}>{e.from}</GridCell>
                <GridCell width={150}>{e.to}</GridCell>
                <GridCell grow>
                  <span className="flex items-center gap-1.5">
                    {e.hasAttachment && <Paperclip className="size-3 shrink-0 text-[#5b6b7d]" />}
                    <span className="truncate">{e.subject}</span>
                  </span>
                </GridCell>
                <GridCell width={150}>{formatAuDateTime(e.date)}</GridCell>
              </GridRow>
            ))
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto border-t border-[#dfe5ec] bg-white p-4">
          {email ? (
            <>
              <div className="text-[14px] font-semibold text-[#22303f]">{email.subject}</div>
              <div className="mt-0.5 text-[11px] text-[#5b6b7d]">
                From {email.from} · to {email.to} · {formatAuDateTime(email.date)}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed whitespace-pre-wrap text-[#22303f]">
                {email.body}
              </p>
            </>
          ) : (
            <EmptyPane>Select an email to preview it.</EmptyPane>
          )}
        </div>
      </div>
    </div>
  );
}

function MemosTab({ composeSignal }: { composeSignal: number }) {
  const { state, dispatch, matter } = useSim();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // The ribbon's Memo button bumps composeSignal to open the composer here.
  // Adjusting state during render (rather than in an effect) is React's
  // recommended pattern for reacting to a changed prop.
  const [lastComposeSignal, setLastComposeSignal] = useState(composeSignal);
  if (composeSignal !== lastComposeSignal) {
    setLastComposeSignal(composeSignal);
    setAdding(true);
    setTitle("");
    setBody("");
  }

  if (!matter) return null;
  const rows = state.memos.filter((m) => m.matterId === matter.id);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[260px] shrink-0 overflow-auto border-r border-[#dfe5ec] bg-white p-2">
        <SimActionButton
          variant="primary"
          className="w-full"
          onClick={() => {
            setAdding(true);
            setTitle("");
            setBody("");
          }}
        >
          <Plus className="mr-1 inline size-3" />
          Add memo
        </SimActionButton>
        <div className="mt-2 grid">
          {rows.map((m) => (
            <div
              key={m.id}
              className={cn(
                "border-b border-[#eef2f6] px-2 py-2 text-[12px]",
                m.createdBySim && "bg-[#f2fbf4]",
              )}
            >
              <div className="truncate font-medium text-[#22303f]">{m.title}</div>
              <div className="text-[11px] text-[#5b6b7d]">
                {m.authorInitials} · {formatAuDateTime(m.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[#f2f5f8] p-3">
        {adding && (
          <div className="mb-3 border border-[#2f7fd0] bg-white">
            <PaneHeader
              actions={
                <button type="button" onClick={() => setAdding(false)}>
                  <X className="size-3.5 text-[#5b6b7d]" />
                </button>
              }
            >
              New memo
            </PaneHeader>
            <div className="grid gap-2 p-3">
              <label className="grid gap-1">
                <SimFieldLabel>Title</SimFieldLabel>
                <SimInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Vacant possession confirmed — 19 August 2026"
                />
              </label>
              <label className="grid gap-1">
                <SimFieldLabel>Note</SimFieldLabel>
                <SimTextarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What were you told, by whom, and when?"
                  className="min-h-[110px]"
                />
              </label>
              <div className="flex justify-end gap-2">
                <SimActionButton variant="plain" onClick={() => setAdding(false)}>
                  Cancel
                </SimActionButton>
                <SimActionButton
                  disabled={title.trim().length === 0 || body.trim().length === 0}
                  onClick={() => {
                    dispatch({
                      type: "ADD_MEMO",
                      matterId: matter.id,
                      title: title.trim(),
                      body: body.trim(),
                    });
                    setAdding(false);
                  }}
                >
                  Save memo
                </SimActionButton>
              </div>
            </div>
          </div>
        )}

        {rows.length === 0 && !adding ? (
          <EmptyPane>No memos on this file yet.</EmptyPane>
        ) : (
          rows.map((m) => (
            <article
              key={m.id}
              className={cn(
                "mb-3 border border-[#dfe5ec] bg-white",
                m.createdBySim && "border-[#a8ce9f]",
              )}
            >
              <div className="flex items-center justify-between border-b border-[#eef2f6] px-3 py-2">
                <span className="text-[14px] font-semibold text-[#22303f]">{m.title}</span>
                <span className="text-[11px] text-[#5b6b7d]">
                  {formatAuDateTime(m.createdAt)} · {m.authorInitials}
                </span>
              </div>
              <p className="px-3 py-3 text-[12px] leading-relaxed whitespace-pre-wrap text-[#22303f]">
                {m.body}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function EventsTab({ focusSignal }: { focusSignal: number }) {
  const { state, dispatch, matter } = useSim();
  const [subject, setSubject] = useState("");
  const [start, setStart] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal > 0) subjectRef.current?.focus();
  }, [focusSignal]);

  if (!matter) return null;
  const rows = state.events.filter((e) => e.matterId === matter.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-end gap-2 border-b border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
        <label className="grid min-w-[260px] flex-1 gap-1">
          <SimFieldLabel>Subject</SimFieldLabel>
          <SimInput
            ref={subjectRef}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Settlement — 14 Marlowe Street (PEXA)"
          />
        </label>
        <label className="grid w-[150px] gap-1">
          <SimFieldLabel>Date</SimFieldLabel>
          <SimInput type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <SimActionButton
          disabled={subject.trim().length === 0 || start.length === 0}
          onClick={() => {
            dispatch({
              type: "ADD_EVENT",
              matterId: matter.id,
              subject: subject.trim(),
              location: "PEXA workspace",
              start: `${start} 11:00 AM`,
              end: `${start} 12:00 PM`,
            });
            setSubject("");
            setStart("");
          }}
        >
          Add
        </SimActionButton>
      </div>
      <PaneHeader>Calendar events</PaneHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <GridHeader>
          <GridCell grow>Subject</GridCell>
          <GridCell width={180}>Location</GridCell>
          <GridCell width={180}>Start</GridCell>
          <GridCell width={180}>End</GridCell>
          <GridCell width={130}>Calendar</GridCell>
        </GridHeader>
        {rows.length === 0 ? (
          <EmptyPane>No events on this matter.</EmptyPane>
        ) : (
          rows.map((e) => (
            <GridRow key={e.id} className={cn(e.createdBySim && "bg-[#f2fbf4]")}>
              <GridCell grow>{e.subject}</GridCell>
              <GridCell width={180}>{e.location}</GridCell>
              <GridCell width={180}>{formatAuDateTime(e.start)}</GridCell>
              <GridCell width={180}>{formatAuDateTime(e.end)}</GridCell>
              <GridCell width={130}>{e.calendar}</GridCell>
            </GridRow>
          ))
        )}
      </div>
    </div>
  );
}

function TasksTab({ focusSignal }: { focusSignal: number }) {
  const { state, dispatch, matter } = useSim();
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal > 0) nameRef.current?.focus();
  }, [focusSignal]);

  if (!matter) return null;
  const rows = state.tasks.filter((t) => t.matterId === matter.id);
  const phoneMessages = state.phoneMessages.filter((pm) => pm.matterId === matter.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-end gap-2 border-b border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
        <label className="grid min-w-[260px] flex-1 gap-1">
          <SimFieldLabel>New task</SimFieldLabel>
          <SimInput
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chase loan approval letter from broker"
          />
        </label>
        <label className="grid w-[150px] gap-1">
          <SimFieldLabel>Due on</SimFieldLabel>
          <SimInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <SimActionButton
          disabled={name.trim().length === 0}
          onClick={() => {
            dispatch({
              type: "ADD_TASK",
              matterId: matter.id,
              name: name.trim(),
              dueOn: due || null,
              category: "Initial Work",
              priority: "Medium",
            });
            setName("");
            setDue("");
          }}
        >
          Add
        </SimActionButton>
      </div>
      {phoneMessages.length > 0 && (
        <div className="shrink-0 border-b border-[#dfe5ec]">
          <PaneHeader>Phone messages ({phoneMessages.length})</PaneHeader>
          {phoneMessages.map((pm) => (
            <div
              key={pm.id}
              className={cn(
                "border-b border-[#eef2f6] px-3 py-2 text-[12px] last:border-b-0",
                pm.createdBySim && "bg-[#f2fbf4]",
              )}
            >
              <div className="font-medium text-[#22303f]">
                {pm.caller}
                {pm.callerPhone && (
                  <span className="ml-2 font-normal text-[#5b6b7d]">{pm.callerPhone}</span>
                )}
              </div>
              <div className="text-[#3c4653]">{pm.summary}</div>
              <div className="text-[11px] text-[#8b98a6]">
                Taken by {pm.takenBy} for {pm.forStaff} · {formatAuDateTime(pm.takenAt)}
              </div>
            </div>
          ))}
        </div>
      )}
      <PaneHeader>Tasks ({rows.length})</PaneHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <GridHeader>
          <GridCell width={34} />
          <GridCell width={90}>Priority</GridCell>
          <GridCell grow>Name</GridCell>
          <GridCell width={140}>Category</GridCell>
          <GridCell width={120}>Due on</GridCell>
          <GridCell width={120}>Completed</GridCell>
          <GridCell width={130}>Assigned to</GridCell>
        </GridHeader>
        {rows.length === 0 ? (
          <EmptyPane>No tasks on this matter.</EmptyPane>
        ) : (
          rows.map((t) => {
            const overdue = !t.completedOn && t.dueOn !== null && t.dueOn < state.today;
            return (
              <GridRow key={t.id} className={cn(t.createdBySim && "bg-[#f2fbf4]")}>
                <GridCell width={34}>
                  <SimCheckbox
                    checked={t.completedOn !== null}
                    onChange={() => dispatch({ type: "TOGGLE_TASK", taskId: t.id })}
                  />
                </GridCell>
                <GridCell width={90}>{t.priority}</GridCell>
                <GridCell
                  grow
                  className={cn(
                    overdue && "font-medium text-[#c8323b]",
                    t.completedOn && "text-[#8b98a6] line-through",
                  )}
                >
                  {t.name}
                </GridCell>
                <GridCell width={140}>{t.category}</GridCell>
                <GridCell width={120} className={cn(overdue && "font-medium text-[#c8323b]")}>
                  {t.dueOn ? formatAuDate(t.dueOn) : "No due date"}
                </GridCell>
                <GridCell width={120}>{t.completedOn ? formatAuDate(t.completedOn) : "—"}</GridCell>
                <GridCell width={130}>{t.assignedTo}</GridCell>
              </GridRow>
            );
          })
        )}
      </div>
    </div>
  );
}

function MatterMessagesTab() {
  const { state, dispatch, matter } = useSim();
  const staff = ["Jennie Tonner", "Harold Galvo", "Monika Stelzner"];
  const [active, setActive] = useState(staff[0]);
  const [draft, setDraft] = useState("");
  if (!matter) return null;
  const thread = state.messages.filter((m) => m.withStaff === active);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[230px] shrink-0 border-r border-[#dfe5ec] bg-white p-2">
        <span className="text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
          Internal matter conversations
        </span>
        <div className="mt-1 grid">
          {staff.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActive(s)}
              className={cn(
                "rounded-[2px] px-2 py-1.5 text-left text-[12px]",
                active === s ? "bg-[#dcebfa] text-[#22303f]" : "text-[#3c4653] hover:bg-[#f2f7fc]",
              )}
            >
              Message {s.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader>{active}</PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {thread.length === 0 ? (
            <EmptyPane>No messages yet on this matter.</EmptyPane>
          ) : (
            thread.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "mb-2 max-w-[70%] rounded-md px-3 py-2 text-[12px]",
                  m.from === state.user.name ? "ml-auto bg-[#dcebfa]" : "bg-[#f2f5f8]",
                )}
              >
                <div className="mb-0.5 text-[10px] font-semibold tracking-wide text-[#5b6b7d] uppercase">
                  {m.from} · {formatAuDateTime(m.sentAt)}
                </div>
                {m.body}
              </div>
            ))
          )}
        </div>
        <div className="shrink-0 border-t border-[#dfe5ec] bg-[#f7fafc] p-2">
          <SimTextarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${active.split(" ")[0]} about this matter`}
          />
          <div className="mt-1 flex justify-end">
            <SimActionButton
              variant="primary"
              disabled={draft.trim().length === 0}
              onClick={() => {
                dispatch({
                  type: "SEND_MESSAGE",
                  withStaff: active,
                  matterId: matter.id,
                  body: draft.trim(),
                });
                setDraft("");
              }}
            >
              <Send className="mr-1 inline size-3" />
              Send
            </SimActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatterActivityTab() {
  const { state, matter } = useSim();
  if (!matter) return null;
  const rows = state.activities.filter((a) => a.matterId === matter.id);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader>Activity on this matter ({rows.length})</PaneHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <GridHeader>
          <GridCell width={170}>Type</GridCell>
          <GridCell width={170}>Time</GridCell>
          <GridCell grow>Description</GridCell>
          <GridCell width={80}>Hours</GridCell>
        </GridHeader>
        {rows.map((a) => (
          <GridRow key={a.id}>
            <GridCell width={170}>{a.kind}</GridCell>
            <GridCell width={170}>{formatAuDateTime(a.time)}</GridCell>
            <GridCell grow>{a.description}</GridCell>
            <GridCell width={80}>{a.hours.toFixed(2)}</GridCell>
          </GridRow>
        ))}
      </div>
    </div>
  );
}

function MatterTimeTab() {
  const { state, dispatch, matter } = useSim();
  // Held in the store, not local state, so the ribbon's Time/Fee and
  // Disbursement buttons can switch it too.
  const sub = state.nav.timeSubTab;
  if (!matter) return null;
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
      {sub === "time" ? (
        <TimeFeesGrid fixedMatterId={matter.id} />
      ) : (
        <DisbursementsGrid fixedMatterId={matter.id} />
      )}
    </div>
  );
}

function TriSearchTab() {
  const { matter } = useSim();
  if (!matter) return null;
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white p-5">
      <div className="mb-4 text-[18px] font-semibold text-[#1e5c8f]">triSearch</div>
      <div className="grid max-w-[720px] gap-2 text-[12px]">
        {[
          { label: "Verification of Identity", status: matter.amlComplete ? "Completed" : "Not started" },
          { label: "KYC onboarding form", status: matter.amlComplete ? "Completed" : "Not started" },
          { label: "PEPs, Sanctions and Adverse media", status: matter.amlComplete ? "Completed" : "Not started" },
          { label: "Source of Funds and Wealth Check", status: "Not started" },
          { label: "Order certificates", status: "Not started" },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border border-[#dfe5ec] px-3 py-2"
          >
            <span className="text-[#22303f]">{row.label}</span>
            <SimTag tone={row.status === "Completed" ? "green" : "gray"}>{row.status}</SimTag>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-[720px] text-[12px] text-[#5b6b7d]">
        Ordering searches and running AML checks costs real money in the live system, so this tab is
        display-only in the simulator. What matters for training is knowing where these live and what
        must be complete before settlement.
      </p>
    </div>
  );
}

function MatterFileTab() {
  const { matter } = useSim();
  if (!matter) return null;
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f2f5f8] p-6">
      <div className="max-w-[520px] border border-[#dfe5ec] bg-white">
        <PaneHeader>File</PaneHeader>
        <div className="grid gap-2 p-4 text-[12px]">
          <div className="flex justify-between border-b border-[#eef2f6] pb-1.5">
            <span className="text-[#5b6b7d]">Matter number</span>
            <span className="font-semibold text-[#22303f]">{matter.number}</span>
          </div>
          <div className="flex justify-between border-b border-[#eef2f6] pb-1.5">
            <span className="text-[#5b6b7d]">Opened</span>
            <span className="font-semibold text-[#22303f]">{formatAuDate(matter.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#5b6b7d]">Fee earner / assistant</span>
            <span className="font-semibold text-[#22303f]">
              {matter.feeEarnerInitials} / {matter.assistantInitials}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen shell                                                        */
/* ------------------------------------------------------------------ */

/** Ribbon actions that open a modal or nudge the tab body. */
export type MatterRibbonDialog =
  | "workflow"
  | "document"
  | "import"
  | "phone"
  | "email"
  | "memo"
  | "focus-form"
  | null;

export function MatterScreen() {
  const { state, dispatch, matter } = useSim();
  const [dialog, setDialog] = useState<MatterRibbonDialog>(null);
  // Counters rather than booleans, so pressing the same ribbon button twice
  // re-triggers the composer / re-focuses the field.
  const [composeSignal, setComposeSignal] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);

  if (!matter) return null;

  const handleRibbon = (d: MatterRibbonDialog) => {
    if (d === "memo") {
      dispatch({ type: "MATTER_TAB", tab: "memos" });
      setComposeSignal((n) => n + 1);
      return;
    }
    if (d === "focus-form") {
      setFocusSignal((n) => n + 1);
      return;
    }
    setDialog(d);
  };

  const tab = state.nav.matterTab;
  const bodies: Record<MatterTab, React.ReactNode> = {
    file: <MatterFileTab />,
    matter: <MatterDetailsTab />,
    emails: <EmailsTab />,
    memos: <MemosTab composeSignal={composeSignal} />,
    events: <EventsTab focusSignal={focusSignal} />,
    tasks: <TasksTab focusSignal={focusSignal} />,
    trisearch: <TriSearchTab />,
    messages: <MatterMessagesTab />,
    activity: <MatterActivityTab />,
    time: <MatterTimeTab />,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <MatterHeader />
      <MatterRibbon onOpenDialog={handleRibbon} />
      {tab === "matter" && <StageRail />}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {bodies[tab]}
        {(dialog === "document" || dialog === "import") && (
          <NewDocumentDialog
            fixedMatterId={matter.id}
            source={dialog === "import" ? "imported" : "created from precedent"}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === "phone" && (
          <PhoneMessageDialog fixedMatterId={matter.id} onClose={() => setDialog(null)} />
        )}
        {dialog === "email" && (
          <EmailComposeDialog matterId={matter.id} onClose={() => setDialog(null)} />
        )}
        {dialog === "workflow" && (
          <ApplyWorkflowDialog matterId={matter.id} onClose={() => setDialog(null)} />
        )}
      </div>
    </div>
  );
}
