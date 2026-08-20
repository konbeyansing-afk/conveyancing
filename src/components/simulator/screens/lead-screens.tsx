"use client";

/**
 * Leads — the pre-retainer version of a matter.
 *
 * Per Smokeball's docs a Lead looks like a matter but has a different header
 * colour and icon, a "Lead Details" heading instead of "Matter Details", a
 * "Lead Type" row instead of "Matter Type", no reference number by default,
 * and a Convert to Matter bar that disappears once converted.
 */

import { useState } from "react";
import { ArrowRight, ChevronRight, Sparkles, UserRoundPlus, X } from "lucide-react";
import { REFERRAL_TYPES, SIM_STAFF } from "@/lib/simulator/seed";
import { formatAuDate, formatMoney, useSim, type NewLeadDraft } from "@/lib/simulator/store";
import { AU_STATES, type AuState, type MatterType } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";
import { WindowTitleBar } from "../chrome/window-chrome";
import {
  PaneHeader,
  SimActionButton,
  SimFieldLabel,
  SimInput,
  SimSelect,
  SimTag,
  SimTextarea,
} from "../sim-primitives";

const LEAD_TYPES: MatterType[] = ["Purchase", "Sale", "Transfer", "Survivorship Application"];

const EMPTY_LEAD: NewLeadDraft = {
  leadType: null,
  state: "NSW",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  propertyAddress: "",
  personResponsible: "",
  referralType: "",
  referrer: "",
  estimatedFee: "",
  notes: "",
};

/** Leads use a teal header so they're never mistaken for a live matter. */
const LEAD_HEADER = "bg-[#2f7d72]";

/* ------------------------------------------------------------------ */
/* New Lead                                                            */
/* ------------------------------------------------------------------ */

export function CreateLeadScreen() {
  const { dispatch } = useSim();
  const [draft, setDraft] = useState<NewLeadDraft>(EMPTY_LEAD);
  const [attempted, setAttempted] = useState(false);

  const set = <K extends keyof NewLeadDraft>(key: K, value: NewLeadDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const missing: string[] = [];
  if (!draft.leadType) missing.push("lead type");
  if (!draft.clientName.trim()) missing.push("name");
  const valid = missing.length === 0;

  const grid = "grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 p-3";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className={cn("shrink-0 text-white", LEAD_HEADER)}>
        <WindowTitleBar title="" dark />
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/40">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[19px] leading-tight font-semibold">New lead</div>
            <div className="text-[12px] text-white/75">
              A prospect who hasn&apos;t retained the firm yet
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "NAV_RAIL", rail: "matters" })}
            className="flex items-center gap-1 rounded border border-white/30 px-2 py-1 text-[11px] text-white/85 hover:bg-white/10"
          >
            <X className="size-3.5" />
            Cancel
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[#f2f5f8] p-4">
        <div className="mx-auto grid max-w-[820px] gap-3">
          <section className="border border-[#dfe5ec] bg-white">
            <PaneHeader>Lead Type</PaneHeader>
            <div className={grid}>
              <label className="grid gap-1">
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
              <label className="grid gap-1">
                <SimFieldLabel>Lead Type</SimFieldLabel>
                <SimSelect
                  value={draft.leadType ?? ""}
                  onChange={(e) => set("leadType", e.target.value as MatterType)}
                >
                  <option value="">—</option>
                  {LEAD_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </SimSelect>
              </label>
            </div>
          </section>

          <section className="border border-[#dfe5ec] bg-white">
            <PaneHeader>Prospect</PaneHeader>
            <div className={grid}>
              <label className="col-span-full grid gap-1">
                <SimFieldLabel>Name</SimFieldLabel>
                <SimInput
                  value={draft.clientName}
                  onChange={(e) => set("clientName", e.target.value)}
                  placeholder="Who rang or enquired?"
                />
              </label>
              <label className="grid gap-1">
                <SimFieldLabel>Email</SimFieldLabel>
                <SimInput
                  value={draft.clientEmail}
                  onChange={(e) => set("clientEmail", e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <SimFieldLabel>Phone</SimFieldLabel>
                <SimInput
                  value={draft.clientPhone}
                  onChange={(e) => set("clientPhone", e.target.value)}
                />
              </label>
              <label className="col-span-full grid gap-1">
                <SimFieldLabel>Property</SimFieldLabel>
                <SimInput
                  value={draft.propertyAddress}
                  onChange={(e) => set("propertyAddress", e.target.value)}
                  placeholder="Address if they have one yet"
                />
              </label>
            </div>
          </section>

          <section className="border border-[#dfe5ec] bg-white">
            <PaneHeader>Staff and referral</PaneHeader>
            <div className={grid}>
              <label className="grid gap-1">
                <SimFieldLabel>Person Responsible</SimFieldLabel>
                <SimSelect
                  value={draft.personResponsible}
                  onChange={(e) => set("personResponsible", e.target.value)}
                >
                  <option value="">—</option>
                  {SIM_STAFF.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SimSelect>
              </label>
              <label className="grid gap-1">
                <SimFieldLabel>Referral Type</SimFieldLabel>
                <SimSelect
                  value={draft.referralType}
                  onChange={(e) => set("referralType", e.target.value)}
                >
                  <option value="">—</option>
                  {REFERRAL_TYPES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </SimSelect>
              </label>
              <label className="grid gap-1">
                <SimFieldLabel>Referrer</SimFieldLabel>
                <SimInput
                  value={draft.referrer}
                  onChange={(e) => set("referrer", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="border border-[#dfe5ec] bg-white">
            <PaneHeader>Financial details and notes</PaneHeader>
            <div className={grid}>
              <label className="grid gap-1">
                <SimFieldLabel>Estimated fee</SimFieldLabel>
                <SimInput
                  value={draft.estimatedFee}
                  onChange={(e) => set("estimatedFee", e.target.value)}
                  placeholder="e.g. 2200"
                />
              </label>
              <label className="col-span-full grid gap-1">
                <SimFieldLabel>Notes</SimFieldLabel>
                <SimTextarea
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="What did they ask for, and what did you promise to do next?"
                />
              </label>
            </div>
          </section>

          {attempted && !valid && (
            <div className="border border-[#f0b8bb] bg-[#fdeef0] p-3 text-[12px] text-[#a02730]">
              Still missing: {missing.join(", ")}.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border border-[#dfe5ec] bg-white p-3">
            <span className="text-[11px] text-[#5b6b7d]">
              Leads have no reference number until they convert to a matter.
            </span>
            <div className="flex gap-2">
              <SimActionButton
                variant="plain"
                onClick={() => dispatch({ type: "NAV_RAIL", rail: "matters" })}
              >
                Cancel
              </SimActionButton>
              <SimActionButton
                variant="primary"
                onClick={() => {
                  setAttempted(true);
                  if (!valid) return;
                  dispatch({ type: "CREATE_LEAD", draft });
                  setDraft(EMPTY_LEAD);
                  setAttempted(false);
                }}
              >
                Create Lead
              </SimActionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lead window                                                         */
/* ------------------------------------------------------------------ */

function LeadDetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#eef2f6] px-3 py-2 text-[12px] last:border-b-0">
      <span className="w-[130px] shrink-0 text-[#5b6b7d]">{label}</span>
      <span className="min-w-0 flex-1 text-[#22303f]">{value}</span>
      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-[#a9bcd0]" />
    </div>
  );
}

export function LeadScreen() {
  const { state, dispatch } = useSim();
  const lead = state.leads.find((l) => l.id === state.nav.leadId);
  if (!lead) return null;

  const converted = lead.status === "Converted";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className={cn("shrink-0 text-white", LEAD_HEADER)}>
        <WindowTitleBar title="" dark />
        <div className="flex items-start gap-3 px-4 pb-2">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-white/40">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[19px] leading-tight font-semibold">
              {lead.clientName}
            </div>
            <div className="truncate text-[12px] text-white/75">
              Lead · {lead.leadType}
              {lead.propertyAddress ? ` · ${lead.propertyAddress}` : ""}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <UserRoundPlus className="size-3.5 text-white/60" />
              <SimTag tone={converted ? "green" : lead.status === "Closed" ? "gray" : "teal"}>
                {lead.status}
              </SimTag>
              {lead.createdBySim && <SimTag tone="green">Created by you</SimTag>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "CLOSE_LEAD" })}
            className="mt-1 flex shrink-0 items-center gap-1 rounded border border-white/30 px-2 py-1 text-[11px] text-white/85 hover:bg-white/10"
          >
            <X className="size-3.5" />
            Close lead
          </button>
        </div>
      </div>

      {/* Convert to Matter bar — disappears once the lead is converted. */}
      {!converted && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#a8ce9f] bg-[#eaf7e4] px-4 py-2">
          <span className="text-[12px] text-[#2f6b39]">
            Has this prospect retained the firm? Converting creates a real matter and carries the
            details across.
          </span>
          <div className="ml-auto flex gap-2">
            <SimActionButton
              variant="plain"
              onClick={() => dispatch({ type: "SET_LEAD_STATUS", leadId: lead.id, status: "Closed" })}
            >
              Close lead
            </SimActionButton>
            <SimActionButton
              variant="primary"
              onClick={() => dispatch({ type: "CONVERT_LEAD", leadId: lead.id })}
            >
              Convert to Matter
              <ArrowRight className="ml-1 inline size-3" />
            </SimActionButton>
          </div>
        </div>
      )}

      {converted && lead.convertedMatterId && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[#dfe5ec] bg-[#f2f7fc] px-4 py-2 text-[12px] text-[#22303f]">
          Converted to a matter.
          <button
            type="button"
            onClick={() => dispatch({ type: "OPEN_MATTER", matterId: lead.convertedMatterId! })}
            className="font-medium text-[#2f7fd0] hover:underline"
          >
            Open the matter
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <PaneHeader>Lead Details</PaneHeader>
        <LeadDetailRow label="Lead Type" value={lead.leadType} />
        <LeadDetailRow label="State" value={lead.state} />
        <LeadDetailRow
          label="Prospect"
          value={
            <>
              {lead.clientName}
              <div className="text-[11px] text-[#5b6b7d]">
                {lead.clientEmail || "No email"} · {lead.clientPhone || "No phone"}
              </div>
            </>
          }
        />
        <LeadDetailRow label="Property" value={lead.propertyAddress || "Not yet identified"} />
        <LeadDetailRow label="Person Responsible" value={lead.personResponsible} />
        <LeadDetailRow
          label="Referral"
          value={
            lead.referralType
              ? `${lead.referralType}${lead.referrer ? ` — ${lead.referrer}` : ""}`
              : "Not recorded"
          }
        />
        <LeadDetailRow
          label="Estimated fee"
          value={lead.estimatedFee !== null ? formatMoney(lead.estimatedFee) : "Not quoted"}
        />
        <LeadDetailRow label="Enquiry date" value={formatAuDate(lead.createdAt)} />
        <div className="p-3">
          <PaneHeader className="mb-0 border border-b-0 border-[#dfe5ec]">Notes</PaneHeader>
          <p className="border border-[#dfe5ec] bg-white p-3 text-[12px] leading-relaxed whitespace-pre-wrap text-[#22303f]">
            {lead.notes || "No notes recorded."}
          </p>
        </div>
      </div>
    </div>
  );
}
