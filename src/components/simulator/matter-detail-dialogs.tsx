"use client";

/**
 * Editable dialogs behind each Matter Details row.
 *
 * Smokeball opens a Matter Info window when you double-click the Info line
 * (Status, dates, Internal Reference, Re Line, Matter Description, staff and
 * referral fields, plus a Billing tab), and lets you edit the other lines the
 * same way. Every row here opens the field group that belongs to it and saves
 * with OK.
 */

import { useState } from "react";
import {
  BILLING_FREQUENCIES,
  BILLING_UNITS,
  REFERRAL_TYPES,
  SIM_STAFF,
} from "@/lib/simulator/seed";
import { useSim } from "@/lib/simulator/store";
import {
  MATTER_STAGES,
  type BillingType,
  type MatterStage,
  type MatterStatus,
  type MatterType,
  type RiskRating,
  type SimMatter,
} from "@/lib/simulator/types";
import { cn } from "@/lib/utils";
import {
  SimActionButton,
  SimCheckbox,
  SimDialog,
  SimFieldLabel,
  SimInput,
  SimSelect,
} from "./sim-primitives";

/** Which Matter Details row was opened. */
export type MatterDetailSection =
  | "info"
  | "client"
  | "matter-type"
  | "other-party"
  | "solicitor"
  | "property"
  | "conveyancing"
  | "title"
  | "risk"
  | "staff"
  | "referral"
  | "billing"
  | "stage";

const SECTION_TITLES: Record<MatterDetailSection, string> = {
  info: "Matter Info",
  client: "Client",
  "matter-type": "Matter Type",
  "other-party": "Other Party",
  solicitor: "Solicitor",
  property: "Property Details",
  conveyancing: "Conveyancing Details",
  title: "Title Reference",
  risk: "Risk Rating",
  staff: "Staff",
  referral: "Referral",
  billing: "Billing",
  stage: "Stage",
};

function Field({
  label,
  children,
  hint,
  full,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  full?: boolean;
}) {
  return (
    <label className={cn("grid gap-1", full && "col-span-full")}>
      <SimFieldLabel>{label}</SimFieldLabel>
      {children}
      {hint && <span className="text-[11px] text-[#5b6b7d]">{hint}</span>}
    </label>
  );
}

export function MatterDetailDialog({
  section,
  onClose,
}: {
  section: MatterDetailSection;
  onClose: () => void;
}) {
  const { dispatch, matter } = useSim();
  const [tab, setTab] = useState<"info" | "billing">("info");

  // Local working copy — nothing is written to the matter until OK.
  const [draft, setDraft] = useState<Partial<SimMatter>>(() => ({ ...matter }));
  if (!matter) return null;

  const set = <K extends keyof SimMatter>(key: K, value: SimMatter[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const num = (v: string) => (v.trim() ? Number(v.replace(/[^0-9.]/g, "")) : null);

  const save = () => {
    dispatch({
      type: "UPDATE_MATTER",
      matterId: matter.id,
      patch: draft,
      section: SECTION_TITLES[section],
    });
    onClose();
  };

  const grid = "grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2.5";

  /* ---------------- Matter Info (with its Billing tab) ---------------- */
  if (section === "info" || section === "billing") {
    const activeTab = section === "billing" ? "billing" : tab;
    return (
      <SimDialog
        title="Matter Info"
        width={620}
        onClose={onClose}
        footer={
          <>
            <SimActionButton variant="plain" onClick={onClose}>
              Cancel
            </SimActionButton>
            <SimActionButton variant="primary" onClick={save}>
              OK
            </SimActionButton>
          </>
        }
      >
        {section === "info" && (
          <div className="-mt-1 flex items-end gap-0 border-b border-[#dfe5ec]">
            {(
              [
                { key: "info", label: "Matter Info" },
                { key: "billing", label: "Billing" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase",
                  activeTab === t.key
                    ? "border-b-2 border-[#2f7fd0] text-[#22303f]"
                    : "text-[#5b6b7d] hover:text-[#22303f]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "info" ? (
          <div className={grid}>
            <Field label="Status">
              <SimSelect
                value={draft.status}
                onChange={(e) => set("status", e.target.value as MatterStatus)}
              >
                {(["Open", "Closed", "Deleted", "Cancelled"] as MatterStatus[]).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SimSelect>
            </Field>
            <Field label="Matter opened">
              <SimInput
                type="date"
                value={draft.createdAt ?? ""}
                onChange={(e) => set("createdAt", e.target.value)}
              />
            </Field>
            <Field label="Internal Reference (matter number)">
              <SimInput
                value={draft.number ?? ""}
                onChange={(e) => {
                  set("number", e.target.value);
                  set("internalReference", e.target.value);
                }}
              />
            </Field>
            <Field label="Re Line" full hint="Appears on letters and invoices.">
              <SimInput
                value={draft.reLine ?? ""}
                onChange={(e) => set("reLine", e.target.value)}
              />
            </Field>
            <Field label="Matter Description" full hint="Searchable.">
              <SimInput
                value={draft.matterDescription ?? ""}
                onChange={(e) => set("matterDescription", e.target.value)}
              />
            </Field>
            <Field label="Person Responsible">
              <SimSelect
                value={draft.personResponsible ?? ""}
                onChange={(e) => set("personResponsible", e.target.value)}
              >
                <option value="">—</option>
                {SIM_STAFF.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SimSelect>
            </Field>
            <Field label="Person/s Assisting">
              <SimSelect
                value={draft.personAssisting ?? ""}
                onChange={(e) => set("personAssisting", e.target.value)}
              >
                <option value="">—</option>
                {SIM_STAFF.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SimSelect>
            </Field>
            <Field label="Introducer/s">
              <SimSelect
                value={draft.introducer ?? ""}
                onChange={(e) => set("introducer", e.target.value)}
              >
                <option value="">—</option>
                {SIM_STAFF.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SimSelect>
            </Field>
            <Field label="Referral Type">
              <SimSelect
                value={draft.referralType ?? ""}
                onChange={(e) => set("referralType", e.target.value)}
              >
                <option value="">—</option>
                {REFERRAL_TYPES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </SimSelect>
            </Field>
            <Field label="Referrer">
              <SimInput
                value={draft.referrer ?? ""}
                onChange={(e) => set("referrer", e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <div className={grid}>
            <Field label="Billing Type">
              <SimSelect
                value={draft.billingType ?? "Fixed Fee"}
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
                value={draft.feeEstimate?.toString() ?? ""}
                onChange={(e) => set("feeEstimate", num(e.target.value))}
              />
            </Field>
            <Field label="Debtor" full>
              <SimInput
                value={draft.debtor ?? ""}
                onChange={(e) => set("debtor", e.target.value)}
              />
            </Field>
            <Field label="Billing Units">
              <SimSelect
                value={draft.billingUnits ?? BILLING_UNITS[0]}
                onChange={(e) => set("billingUnits", e.target.value)}
                disabled={draft.billingType !== "Time-Based"}
              >
                {BILLING_UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </SimSelect>
            </Field>
            <Field
              label="Hourly Rates"
              hint={draft.billingType === "Time-Based" ? undefined : "Time-based billing only."}
            >
              <SimInput
                value={draft.hourlyRate?.toString() ?? ""}
                onChange={(e) => set("hourlyRate", num(e.target.value))}
                disabled={draft.billingType !== "Time-Based"}
              />
            </Field>
            <Field label="Billing Frequency">
              <SimSelect
                value={draft.billingFrequency ?? BILLING_FREQUENCIES[0]}
                onChange={(e) => set("billingFrequency", e.target.value)}
              >
                {BILLING_FREQUENCIES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </SimSelect>
            </Field>
          </div>
        )}
      </SimDialog>
    );
  }

  /* ---------------- Everything else ---------------- */
  let body: React.ReactNode = null;

  if (section === "client") {
    body = (
      <div className={grid}>
        <Field label="Client name" full>
          <SimInput
            value={draft.clientName ?? ""}
            onChange={(e) => set("clientName", e.target.value)}
          />
        </Field>
        <Field label="Client Role">
          <SimInput
            value={draft.clientRole ?? ""}
            onChange={(e) => set("clientRole", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <SimInput
            value={draft.clientEmail ?? ""}
            onChange={(e) => set("clientEmail", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <SimInput
            value={draft.clientPhone ?? ""}
            onChange={(e) => set("clientPhone", e.target.value)}
          />
        </Field>
        <div className="col-span-full border border-[#f0d8a8] bg-[#fdf6e3] p-2.5">
          <SimCheckbox
            checked={draft.amlComplete ?? false}
            onChange={(v) => set("amlComplete", v)}
            label="AML & VOI complete for every client on this matter"
          />
          <p className="mt-1.5 text-[11px] text-[#7a5c10]">
            Only tick once ID has actually been sighted and verified.
          </p>
        </div>
      </div>
    );
  }

  if (section === "matter-type") {
    body = (
      <div className={grid}>
        <Field label="Matter Type" hint="Changing this changes every precedent the file uses.">
          <SimSelect
            value={draft.type}
            onChange={(e) => set("type", e.target.value as MatterType)}
          >
            {(["Purchase", "Sale", "Transfer", "Survivorship Application"] as MatterType[]).map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </SimSelect>
        </Field>
      </div>
    );
  }

  if (section === "other-party") {
    body = (
      <div className={grid}>
        <Field label="Other party name" full>
          <SimInput
            value={draft.otherPartyName ?? ""}
            onChange={(e) => set("otherPartyName", e.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (section === "solicitor") {
    body = (
      <div className={grid}>
        <Field label="Firm" full>
          <SimInput
            value={draft.otherPartySolicitor ?? ""}
            onChange={(e) => set("otherPartySolicitor", e.target.value)}
          />
        </Field>
        <Field label="Contact" full>
          <SimInput
            value={draft.otherPartySolicitorContact ?? ""}
            onChange={(e) => set("otherPartySolicitorContact", e.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (section === "property" || section === "title") {
    body = (
      <div className={grid}>
        <Field label="Property address" full hint="Copy from the contract, not the listing.">
          <SimInput
            value={draft.propertyAddress ?? ""}
            onChange={(e) => set("propertyAddress", e.target.value)}
          />
        </Field>
        <Field label="Title reference">
          <SimInput
            value={draft.titleReference ?? ""}
            onChange={(e) => set("titleReference", e.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (section === "conveyancing") {
    body = (
      <div className={grid}>
        <Field
          label="Settlement date"
          hint="Leave empty if unknown — never enter a placeholder date."
        >
          <SimInput
            type="date"
            value={draft.settlementDate ?? ""}
            onChange={(e) => set("settlementDate", e.target.value || null)}
          />
        </Field>
        <Field label="Price">
          <SimInput
            value={draft.purchasePrice?.toString() ?? ""}
            onChange={(e) => set("purchasePrice", num(e.target.value))}
          />
        </Field>
        <Field label="Deposit paid">
          <SimInput
            value={draft.depositPaid?.toString() ?? ""}
            onChange={(e) => set("depositPaid", num(e.target.value))}
          />
        </Field>
      </div>
    );
  }

  if (section === "risk") {
    body = (
      <div className="grid gap-2">
        <SimFieldLabel>Risk rating</SimFieldLabel>
        <div className="flex flex-wrap gap-2">
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
        <p className="text-[11px] text-[#5b6b7d]">
          A VA records the rating they were given. Escalate anything unusual to the fee earner
          rather than deciding the rating yourself.
        </p>
      </div>
    );
  }

  if (section === "staff") {
    body = (
      <div className={grid}>
        <Field label="Person Responsible">
          <SimSelect
            value={draft.personResponsible ?? ""}
            onChange={(e) => set("personResponsible", e.target.value)}
          >
            <option value="">—</option>
            {SIM_STAFF.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SimSelect>
        </Field>
        <Field label="Person/s Assisting">
          <SimSelect
            value={draft.personAssisting ?? ""}
            onChange={(e) => set("personAssisting", e.target.value)}
          >
            <option value="">—</option>
            {SIM_STAFF.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SimSelect>
        </Field>
        <Field label="Introducer/s">
          <SimSelect
            value={draft.introducer ?? ""}
            onChange={(e) => set("introducer", e.target.value)}
          >
            <option value="">—</option>
            {SIM_STAFF.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SimSelect>
        </Field>
      </div>
    );
  }

  if (section === "referral") {
    body = (
      <div className={grid}>
        <Field label="Referral Type">
          <SimSelect
            value={draft.referralType ?? ""}
            onChange={(e) => set("referralType", e.target.value)}
          >
            <option value="">—</option>
            {REFERRAL_TYPES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SimSelect>
        </Field>
        <Field label="Referrer">
          <SimInput
            value={draft.referrer ?? ""}
            onChange={(e) => set("referrer", e.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (section === "stage") {
    body = (
      <div className="grid gap-2">
        <SimFieldLabel>Stage</SimFieldLabel>
        <div className="grid gap-1">
          {MATTER_STAGES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => set("stage", st as MatterStage)}
              className={cn(
                "rounded-[2px] border px-2 py-1.5 text-left text-[12px]",
                draft.stage === st
                  ? "border-[#2f7fd0] bg-[#dcebfa] text-[#22303f]"
                  : "border-[#dfe5ec] bg-white text-[#3c4653] hover:bg-[#f2f7fc]",
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <SimDialog
      title={SECTION_TITLES[section]}
      width={520}
      onClose={onClose}
      footer={
        <>
          <SimActionButton variant="plain" onClick={onClose}>
            Cancel
          </SimActionButton>
          <SimActionButton variant="primary" onClick={save}>
            OK
          </SimActionButton>
        </>
      }
    >
      {body}
    </SimDialog>
  );
}
