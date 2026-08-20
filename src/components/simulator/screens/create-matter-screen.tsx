"use client";

/**
 * Create Matter — modelled on Smokeball's own flow.
 *
 * Two phases, exactly as in the real product:
 *   1. a matter-type picker (State dropdown + expandable area-of-law folders)
 *      ending in Create / Next;
 *   2. a five-step wizard — Client/Contacts, Matter Details, Staff,
 *      Billing Fees and Rates — with the Quick Links panel down the left and
 *      Next / Create Matter at the foot.
 *
 * Field labels deliberately match Smokeball's wording ("Internal Reference
 * (matter number)", "Re Line", "Person/s Assisting", "Fee/Estimate" …) so what
 * a trainee learns here transfers to the live system.
 */

import { useState } from "react";
import {
  ArrowLeftRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Home,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import {
  BILLING_FREQUENCIES,
  BILLING_UNITS,
  REFERRAL_TYPES,
  SIM_STAFF,
  SIM_TODAY,
} from "@/lib/simulator/seed";
import { useSim, type NewMatterDraft } from "@/lib/simulator/store";
import {
  AU_STATES,
  type AreaOfLaw,
  type AuState,
  type BillingType,
  type MatterType,
  type RiskRating,
} from "@/lib/simulator/types";
import { cn } from "@/lib/utils";
import { WindowTitleBar } from "../chrome/window-chrome";
import {
  PaneHeader,
  SimActionButton,
  SimCheckbox,
  SimFieldLabel,
  SimInput,
  SimSelect,
  SimTag,
} from "../sim-primitives";

/* ------------------------------------------------------------------ */
/* Matter type catalogue                                               */
/* ------------------------------------------------------------------ */

const MATTER_TYPE_TREE: {
  area: AreaOfLaw;
  types: { type: MatterType; icon: typeof Home; blurb: string }[];
}[] = [
  {
    area: "Conveyancing",
    types: [
      { type: "Purchase", icon: Home, blurb: "The firm acts for the buyer." },
      { type: "Sale", icon: Building2, blurb: "The firm acts for the seller." },
      { type: "Transfer", icon: ArrowLeftRight, blurb: "Change of ownership with no sale price." },
    ],
  },
  {
    area: "Estates",
    types: [
      {
        type: "Survivorship Application",
        icon: UserRound,
        blurb: "Removing a deceased joint tenant from title.",
      },
    ],
  },
];

const CLIENT_ROLES: Record<MatterType, string[]> = {
  Purchase: ["Purchaser", "Transferee"],
  Sale: ["Vendor", "Transferor"],
  Transfer: ["Transferee", "Transferor"],
  "Survivorship Application": ["Applicant", "Executor"],
};

const EMPTY: NewMatterDraft = {
  state: "NSW",
  areaOfLaw: null,
  type: null,
  clientName: "",
  clientRole: "",
  clientEmail: "",
  clientPhone: "",
  otherPartyName: "",
  otherPartySolicitor: "",
  riskRating: null,
  amlComplete: false,
  internalReference: "",
  reLine: "",
  matterDescription: "",
  matterOpened: SIM_TODAY,
  propertyAddress: "",
  titleReference: "",
  purchasePrice: "",
  settlementDate: "",
  personResponsible: "",
  personAssisting: "",
  introducer: "",
  referralType: "",
  referrer: "",
  debtor: "",
  billingType: "Fixed Fee",
  feeEstimate: "",
  billingUnits: "6 minute units",
  billingFrequency: "On completion",
  hourlyRate: "",
};

/* ------------------------------------------------------------------ */
/* Quick Links (the wizard's left panel)                               */
/* ------------------------------------------------------------------ */

type StepKey = "client" | "details" | "staff" | "billing";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "client", label: "Client/Contacts" },
  { key: "details", label: "Matter Details" },
  { key: "staff", label: "Staff" },
  { key: "billing", label: "Billing Fees and Rates" },
];

/** Quick links Smokeball shows that this simulator doesn't model. */
const QUICK_LINKS_UNAVAILABLE = [
  { label: "Trust Settings", reason: "trust accounting isn't simulated" },
  { label: "Late Payment", reason: "interest and late-payment rules aren't simulated" },
  { label: "Communication", reason: "communication preferences aren't simulated" },
  { label: "Invoice Settings", reason: "invoice templates aren't simulated" },
];

function QuickLinks({
  step,
  furthest,
  onSelect,
}: {
  step: StepKey;
  furthest: number;
  onSelect: (key: StepKey) => void;
}) {
  return (
    <nav className="w-[210px] shrink-0 overflow-auto border-r border-[#dfe5ec] bg-white p-2">
      <span className="px-1 text-[10px] font-semibold tracking-wide text-[#8b98a6] uppercase">
        Quick links
      </span>
      <div className="mt-1 grid">
        {STEPS.map((s, i) => {
          const active = step === s.key;
          const done = i < furthest;
          const reachable = i <= furthest;
          return (
            <button
              key={s.key}
              type="button"
              disabled={!reachable}
              onClick={() => onSelect(s.key)}
              className={cn(
                "flex items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-[12px]",
                active
                  ? "bg-[#dcebfa] font-medium text-[#22303f]"
                  : reachable
                    ? "text-[#3c4653] hover:bg-[#f2f7fc]"
                    : "cursor-not-allowed text-[#b6c0cb]",
              )}
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold",
                  done
                    ? "bg-[#3f9e5a] text-white"
                    : active
                      ? "bg-[#2f7fd0] text-white"
                      : "bg-[#e3e9ef] text-[#7a8794]",
                )}
              >
                {done ? <Check className="size-2.5" /> : i + 2}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-[#eef2f6] pt-2">
        {QUICK_LINKS_UNAVAILABLE.map((q) => (
          <span
            key={q.label}
            title={`${q.label} — ${q.reason}`}
            className="block cursor-not-allowed px-2 py-1.5 text-[12px] text-[#b6c0cb]"
          >
            {q.label}
          </span>
        ))}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 1 — matter type picker                                        */
/* ------------------------------------------------------------------ */

function MatterTypePicker({
  draft,
  set,
  onNext,
  onCancel,
}: {
  draft: NewMatterDraft;
  set: <K extends keyof NewMatterDraft>(key: K, value: NewMatterDraft[K]) => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const [openAreas, setOpenAreas] = useState<AreaOfLaw[]>(["Conveyancing"]);
  const toggleArea = (area: AreaOfLaw) =>
    setOpenAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));

  const selected = MATTER_TYPE_TREE.flatMap((g) => g.types).find((t) => t.type === draft.type);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f2f5f8] p-4">
      <div className="mx-auto max-w-[720px] border border-[#dfe5ec] bg-white">
        <PaneHeader>Step 1 of 5 — Matter type</PaneHeader>

        <div className="border-b border-[#eef2f6] p-3">
          <label className="grid w-[180px] gap-1">
            <SimFieldLabel>State</SimFieldLabel>
            <SimSelect
              value={draft.state}
              onChange={(e) => set("state", e.target.value as AuState)}
            >
              {AU_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SimSelect>
          </label>
          <p className="mt-2 text-[11px] text-[#5b6b7d]">
            The state decides which contract, forms and precedents the matter uses. Changing it
            later means redoing the file, so get it right now.
          </p>
        </div>

        <div className="p-3">
          <SimFieldLabel className="mb-1.5">Area of law and matter type</SimFieldLabel>
          <div className="border border-[#dfe5ec]">
            {MATTER_TYPE_TREE.map((group) => {
              const open = openAreas.includes(group.area);
              return (
                <div key={group.area} className="border-b border-[#eef2f6] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleArea(group.area)}
                    className="flex w-full items-center gap-1.5 bg-[#f7fafc] px-2 py-1.5 text-left text-[12px] font-medium text-[#22303f] hover:bg-[#eef3f8]"
                  >
                    {open ? (
                      <ChevronDown className="size-3.5 text-[#5b6b7d]" />
                    ) : (
                      <ChevronRight className="size-3.5 text-[#5b6b7d]" />
                    )}
                    {open ? (
                      <FolderOpen className="size-3.5 text-[#e0a93e]" />
                    ) : (
                      <Folder className="size-3.5 text-[#e0a93e]" />
                    )}
                    {group.area}
                  </button>
                  {open && (
                    <div className="grid">
                      {group.types.map((t) => {
                        const Icon = t.icon;
                        const active = draft.type === t.type;
                        return (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => {
                              set("type", t.type);
                              set("areaOfLaw", group.area);
                              set("clientRole", CLIENT_ROLES[t.type][0]);
                            }}
                            className={cn(
                              "flex items-start gap-2 border-t border-[#f2f5f8] px-2 py-2 pl-8 text-left",
                              active ? "bg-[#dcebfa]" : "hover:bg-[#f7fafc]",
                            )}
                          >
                            <Icon
                              className={cn(
                                "mt-0.5 size-4 shrink-0",
                                active ? "text-[#2f7fd0]" : "text-[#5b6b7d]",
                              )}
                            />
                            <span className="min-w-0">
                              <span className="block text-[12px] font-medium text-[#22303f]">
                                {t.type}
                              </span>
                              <span className="block text-[11px] text-[#5b6b7d]">{t.blurb}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
          <span className="text-[11px] text-[#5b6b7d]">
            {selected ? (
              <>
                Selected: <span className="font-medium text-[#22303f]">{draft.state}</span> ·{" "}
                <span className="font-medium text-[#22303f]">{draft.areaOfLaw}</span> ·{" "}
                <span className="font-medium text-[#22303f]">{selected.type}</span>
              </>
            ) : (
              "Choose a matter type to continue"
            )}
          </span>
          <div className="flex gap-2">
            <SimActionButton variant="plain" onClick={onCancel}>
              Cancel
            </SimActionButton>
            <SimActionButton variant="primary" disabled={!draft.type} onClick={onNext}>
              Next
            </SimActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 2 — the wizard steps                                          */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1", className)}>
      <SimFieldLabel>{label}</SimFieldLabel>
      {children}
      {hint && <span className="text-[11px] text-[#5b6b7d]">{hint}</span>}
    </label>
  );
}

function ClientStep({
  draft,
  set,
}: {
  draft: NewMatterDraft;
  set: <K extends keyof NewMatterDraft>(key: K, value: NewMatterDraft[K]) => void;
}) {
  const roles = draft.type ? CLIENT_ROLES[draft.type] : [];
  return (
    <div className="grid gap-3">
      <section className="border border-[#dfe5ec] bg-white">
        <PaneHeader>Client</PaneHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 p-3">
          <Field
            label="Client name"
            className="col-span-full"
            hint="Spell it exactly as it appears on the contract and on their ID — not how the agent typed it in an email."
          >
            <SimInput
              value={draft.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              placeholder="Search existing contacts, or type a new name"
            />
          </Field>
          <div className="col-span-full -mt-1">
            <button
              type="button"
              className="text-[11px] font-semibold text-[#2f7fd0] hover:underline"
              onClick={() => set("clientName", draft.clientName)}
            >
              + New Client
            </button>
          </div>
          <Field label="Client Role">
            <SimSelect value={draft.clientRole} onChange={(e) => set("clientRole", e.target.value)}>
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </SimSelect>
          </Field>
          <Field label="Email">
            <SimInput
              value={draft.clientEmail}
              onChange={(e) => set("clientEmail", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <SimInput
              value={draft.clientPhone}
              onChange={(e) => set("clientPhone", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="border border-[#dfe5ec] bg-white">
        <PaneHeader>Other Side</PaneHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 p-3">
          <Field label="Other side name">
            <SimInput
              value={draft.otherPartyName}
              onChange={(e) => set("otherPartyName", e.target.value)}
              placeholder="Leave blank rather than guessing"
            />
          </Field>
          <Field label="Their solicitor / conveyancer">
            <SimInput
              value={draft.otherPartySolicitor}
              onChange={(e) => set("otherPartySolicitor", e.target.value)}
            />
          </Field>
          <div className="col-span-full -mt-1">
            <button
              type="button"
              className="text-[11px] font-semibold text-[#2f7fd0] hover:underline"
              onClick={() => set("otherPartyName", draft.otherPartyName)}
            >
              + New Other Side
            </button>
          </div>
        </div>
      </section>

      <section className="border border-[#f0d8a8] bg-[#fdf6e3]">
        <PaneHeader className="border-[#f0d8a8] bg-[#f8edd4]">Risk assessment</PaneHeader>
        <div className="grid gap-3 p-3">
          <div className="grid gap-1">
            <SimFieldLabel>Initial risk rating</SimFieldLabel>
            <div className="flex gap-2">
              {(["Low", "Medium", "High"] as RiskRating[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("riskRating", r)}
                  className={cn(
                    "h-[26px] border px-3 text-[11px] font-semibold tracking-wide uppercase",
                    draft.riskRating === r
                      ? "border-[#2f7fd0] bg-[#2f7fd0] text-white"
                      : "border-[#a9bcd0] bg-white text-[#3c4653] hover:bg-[#f2f7fc]",
                  )}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                onClick={() => set("riskRating", null)}
                className="h-[26px] border border-[#a9bcd0] bg-white px-3 text-[11px] font-semibold tracking-wide text-[#5b6b7d] uppercase hover:bg-[#f2f7fc]"
              >
                Not assessed
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[#7a5c10] uppercase">
              <ShieldAlert className="size-3.5" />
              AML / KYC
            </div>
            <SimCheckbox
              checked={draft.amlComplete}
              onChange={(v) => set("amlComplete", v)}
              label="Identity verified and KYC onboarding complete for every client on this matter"
            />
            <p className="mt-1.5 text-[11px] text-[#7a5c10]">
              Only tick this once ID has actually been sighted and verified. Ticking it to make the
              file look tidy is a compliance breach, not a shortcut.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailsStep({
  draft,
  set,
  suggestedNumber,
}: {
  draft: NewMatterDraft;
  set: <K extends keyof NewMatterDraft>(key: K, value: NewMatterDraft[K]) => void;
  suggestedNumber: string;
}) {
  return (
    <div className="grid gap-3">
      <section className="border border-[#dfe5ec] bg-white">
        <PaneHeader>Matter Info</PaneHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 p-3">
          <Field label="Internal Reference (matter number)" hint={`Leave blank to use ${suggestedNumber}`}>
            <SimInput
              value={draft.internalReference}
              onChange={(e) => set("internalReference", e.target.value)}
              placeholder={suggestedNumber}
            />
          </Field>
          <Field label="Matter Opened">
            <SimInput
              type="date"
              value={draft.matterOpened}
              onChange={(e) => set("matterOpened", e.target.value)}
            />
          </Field>
          <Field label="Re Line" className="col-span-full" hint="Appears on letters and invoices.">
            <SimInput
              value={draft.reLine}
              onChange={(e) => set("reLine", e.target.value)}
              placeholder="e.g. Ashcroft-Reyes — Purchase of 5/40 Ferndale Road, Epping"
            />
          </Field>
          <Field
            label="Matter Description"
            className="col-span-full"
            hint="Searchable — write what you'd type to find this file again."
          >
            <SimInput
              value={draft.matterDescription}
              onChange={(e) => set("matterDescription", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="border border-[#dfe5ec] bg-white">
        <PaneHeader>Property</PaneHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 p-3">
          <Field
            label="Property address"
            className="col-span-full"
            hint="Copy from the contract, not from the listing."
          >
            <SimInput
              value={draft.propertyAddress}
              onChange={(e) => set("propertyAddress", e.target.value)}
              placeholder="e.g. 5/40 Ferndale Road, Epping NSW 2121"
            />
          </Field>
          <Field label="Title reference">
            <SimInput
              value={draft.titleReference}
              onChange={(e) => set("titleReference", e.target.value)}
              placeholder="e.g. 12/SP84421"
            />
          </Field>
          <Field label="Price (if known)">
            <SimInput
              value={draft.purchasePrice}
              onChange={(e) => set("purchasePrice", e.target.value)}
              placeholder="e.g. 985000"
            />
          </Field>
          <Field
            label="Settlement date"
            hint="Leave empty if unknown — never enter a placeholder someone will later rely on."
          >
            <SimInput
              type="date"
              value={draft.settlementDate}
              onChange={(e) => set("settlementDate", e.target.value)}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function StaffStep({
  draft,
  set,
}: {
  draft: NewMatterDraft;
  set: <K extends keyof NewMatterDraft>(key: K, value: NewMatterDraft[K]) => void;
}) {
  return (
    <div className="grid gap-3">
      <section className="border border-[#dfe5ec] bg-white">
        <PaneHeader>Staff</PaneHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 p-3">
          <Field
            label="Person Responsible"
            hint="The fee earner who owns the file and signs off the advice."
          >
            <SimSelect
              value={draft.personResponsible}
              onChange={(e) => set("personResponsible", e.target.value)}
            >
              <option value="">—</option>
              {SIM_STAFF.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SimSelect>
          </Field>
          <Field label="Person/s Assisting" hint="Usually you.">
            <SimSelect
              value={draft.personAssisting}
              onChange={(e) => set("personAssisting", e.target.value)}
            >
              <option value="">—</option>
              {SIM_STAFF.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SimSelect>
          </Field>
          <Field label="Introducer/s">
            <SimSelect value={draft.introducer} onChange={(e) => set("introducer", e.target.value)}>
              <option value="">—</option>
              {SIM_STAFF.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SimSelect>
          </Field>
        </div>
      </section>

      <section className="border border-[#dfe5ec] bg-white">
        <PaneHeader>Referral</PaneHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 p-3">
          <Field label="Referral Type">
            <SimSelect
              value={draft.referralType}
              onChange={(e) => set("referralType", e.target.value)}
            >
              <option value="">—</option>
              {REFERRAL_TYPES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </SimSelect>
          </Field>
          <Field label="Referrer" hint="Who sent the client to us — the firm pays attention to this.">
            <SimInput value={draft.referrer} onChange={(e) => set("referrer", e.target.value)} />
          </Field>
        </div>
      </section>
    </div>
  );
}

function BillingStep({
  draft,
  set,
}: {
  draft: NewMatterDraft;
  set: <K extends keyof NewMatterDraft>(key: K, value: NewMatterDraft[K]) => void;
}) {
  const timeBased = draft.billingType === "Time-Based";
  return (
    <div className="grid gap-3">
      <section className="border border-[#dfe5ec] bg-white">
        <PaneHeader>Billing Fees and Rates</PaneHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 p-3">
          <Field label="Debtor" hint="Who gets the invoice — not always the client.">
            <SimInput
              value={draft.debtor}
              onChange={(e) => set("debtor", e.target.value)}
              placeholder={draft.clientName || "Client name"}
            />
          </Field>
          <Field label="Billing Type">
            <SimSelect
              value={draft.billingType}
              onChange={(e) => set("billingType", e.target.value as BillingType)}
            >
              {(["Fixed Fee", "Time-Based", "Contingency", "Non-billable"] as BillingType[]).map(
                (b) => (
                  <option key={b}>{b}</option>
                ),
              )}
            </SimSelect>
          </Field>
          <Field label="Fee/Estimate">
            <SimInput
              value={draft.feeEstimate}
              onChange={(e) => set("feeEstimate", e.target.value)}
              placeholder="e.g. 2200"
            />
          </Field>
          <Field label="Billing Units">
            <SimSelect
              value={draft.billingUnits}
              onChange={(e) => set("billingUnits", e.target.value)}
              disabled={!timeBased}
            >
              {BILLING_UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </SimSelect>
          </Field>
          <Field
            label="Hourly Rates"
            hint={timeBased ? undefined : "Only applies to time-based billing."}
          >
            <SimInput
              value={draft.hourlyRate}
              onChange={(e) => set("hourlyRate", e.target.value)}
              placeholder="e.g. 350"
              disabled={!timeBased}
            />
          </Field>
          <Field label="Billing Frequency">
            <SimSelect
              value={draft.billingFrequency}
              onChange={(e) => set("billingFrequency", e.target.value)}
            >
              {BILLING_FREQUENCIES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </SimSelect>
          </Field>
        </div>
      </section>
      <p className="text-[11px] text-[#5b6b7d]">
        Billing details are optional at intake — the fee earner usually confirms the fee before the
        first invoice. Enter what you were told and leave the rest blank.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function CreateMatterScreen() {
  const { state, dispatch } = useSim();
  const [draft, setDraft] = useState<NewMatterDraft>(EMPTY);
  const [phase, setPhase] = useState<"type" | "wizard">("type");
  const [step, setStep] = useState<StepKey>("client");
  const [furthest, setFurthest] = useState(0);
  const [attempted, setAttempted] = useState(false);

  const set = <K extends keyof NewMatterDraft>(key: K, value: NewMatterDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const suggestedNumber = String(
    state.matters.reduce((max, m) => Math.max(max, Number(m.number)), 0) + 1,
  ).padStart(6, "0");

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const isLast = stepIndex === STEPS.length - 1;

  const missing: string[] = [];
  if (!draft.type) missing.push("matter type");
  if (!draft.clientName.trim()) missing.push("client name");
  if (!draft.propertyAddress.trim()) missing.push("property address");
  const valid = missing.length === 0;

  const goTo = (key: StepKey) => {
    setStep(key);
    setFurthest((f) => Math.max(f, STEPS.findIndex((s) => s.key === key)));
  };

  const cancel = () => dispatch({ type: "NAV_RAIL", rail: "matters" });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Dark banner, as on a real matter window */}
      <div className="shrink-0 bg-[#46566c] text-white">
        <WindowTitleBar title="" dark />
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/40">
            <Home className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[19px] leading-tight font-semibold">New matter</div>
            <div className="truncate text-[12px] text-white/75">
              {draft.type
                ? `${draft.state} · ${draft.areaOfLaw} · ${draft.type}`
                : "Choose a state and matter type to begin"}
            </div>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="flex items-center gap-1 rounded border border-white/30 px-2 py-1 text-[11px] text-white/85 hover:bg-white/10"
          >
            <X className="size-3.5" />
            Cancel
          </button>
        </div>
      </div>

      {phase === "type" ? (
        <MatterTypePicker
          draft={draft}
          set={set}
          onCancel={cancel}
          onNext={() => {
            setPhase("wizard");
            setStep("client");
            setFurthest(0);
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <QuickLinks step={step} furthest={furthest} onSelect={goTo} />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
              <span className="text-[13px] font-semibold text-[#22303f]">
                Step {stepIndex + 2} of {STEPS.length + 1} — {STEPS[stepIndex].label}
              </span>
              <SimTag tone="gray" className="ml-auto">
                {draft.state} · {draft.type}
              </SimTag>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-[#f2f5f8] p-4">
              <div className="mx-auto max-w-[820px] grid gap-3">
                {step === "client" && <ClientStep draft={draft} set={set} />}
                {step === "details" && (
                  <DetailsStep draft={draft} set={set} suggestedNumber={suggestedNumber} />
                )}
                {step === "staff" && <StaffStep draft={draft} set={set} />}
                {step === "billing" && <BillingStep draft={draft} set={set} />}

                {attempted && !valid && (
                  <div className="border border-[#f0b8bb] bg-[#fdeef0] p-3 text-[12px] text-[#a02730]">
                    Still missing: {missing.join(", ")}. Check the Client/Contacts and Matter
                    Details steps.
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#dfe5ec] bg-white px-3 py-2">
              <span className="text-[11px] text-[#5b6b7d]">
                The matter will be created at stage{" "}
                <SimTag tone="gray">Matter Preparation</SimTag>
              </span>
              <div className="flex gap-2">
                <SimActionButton
                  variant="plain"
                  onClick={() => {
                    if (stepIndex === 0) setPhase("type");
                    else goTo(STEPS[stepIndex - 1].key);
                  }}
                >
                  Back
                </SimActionButton>
                {isLast ? (
                  <SimActionButton
                    variant="primary"
                    onClick={() => {
                      setAttempted(true);
                      if (!valid) return;
                      dispatch({ type: "CREATE_MATTER", draft });
                      setDraft(EMPTY);
                      setAttempted(false);
                      setPhase("type");
                    }}
                  >
                    Create Matter
                  </SimActionButton>
                ) : (
                  <SimActionButton
                    variant="primary"
                    onClick={() => goTo(STEPS[stepIndex + 1].key)}
                  >
                    Next
                  </SimActionButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
