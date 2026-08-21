"use client";

/**
 * Client-side state for the practice-management simulator.
 *
 * The simulator is deliberately self-contained: nothing here touches the
 * database. Every mutation also appends to `state.log`, which is what the
 * guided-task checker reads to decide whether a trainee actually performed
 * the step (rather than just landing on the right screen).
 */

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { createSeedState, SIM_TODAY } from "./seed";
import type {
  AreaOfLaw,
  AuState,
  BillingType,
  HomeMenu,
  HomeRail,
  MatterStage,
  MatterTab,
  MatterType,
  SimDisbursement,
  SimEvent,
  LeadStatus,
  SimLead,
  SimLogEntry,
  SimLogType,
  WorkflowDueRule,
  SimContact,
  SimDocument,
  SimEmail,
  SimMatter,
  SimMemo,
  SimPhoneMessage,
  SimState,
  SimTask,
  SimTimeEntry,
} from "./types";

/**
 * Mirrors the Create Matter wizard, step by step.
 * Field names follow Smokeball's own labels so the training transfers.
 */
export type NewMatterDraft = {
  // Step 1 — matter type
  state: AuState;
  areaOfLaw: AreaOfLaw | null;
  type: MatterType | null;
  // Step 2 — client/contacts
  clientName: string;
  clientRole: string;
  clientEmail: string;
  clientPhone: string;
  otherPartyName: string;
  otherPartySolicitor: string;
  riskRating: SimMatter["riskRating"];
  amlComplete: boolean;
  // Step 3 — matter details
  internalReference: string;
  reLine: string;
  matterDescription: string;
  matterOpened: string;
  propertyAddress: string;
  titleReference: string;
  purchasePrice: string;
  settlementDate: string;
  // Step 4 — staff
  personResponsible: string;
  personAssisting: string;
  introducer: string;
  referralType: string;
  referrer: string;
  // Step 5 — billing fees and rates
  debtor: string;
  billingType: BillingType;
  feeEstimate: string;
  billingUnits: string;
  billingFrequency: string;
  hourlyRate: string;
};

export type NewLeadDraft = {
  leadType: MatterType | null;
  state: AuState;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  propertyAddress: string;
  personResponsible: string;
  referralType: string;
  referrer: string;
  estimatedFee: string;
  notes: string;
};

export type SimAction =
  | { type: "NAV_RAIL"; rail: HomeRail }
  | { type: "NAV_HOME_MENU"; menu: HomeMenu }
  | { type: "NAV_MATTER_FOLDER"; folder: MatterType | "All" }
  | { type: "NAV_TIME_SUBTAB"; subTab: "time" | "disbursements" }
  | { type: "OPEN_MATTER"; matterId: string }
  | { type: "CLOSE_MATTER" }
  | { type: "MATTER_TAB"; tab: MatterTab }
  | { type: "OPEN_CREATE_MATTER" }
  | { type: "ADD_MEMO"; matterId: string; title: string; body: string }
  | { type: "ADD_TASK"; matterId: string | null; name: string; dueOn: string | null; category: SimTask["category"]; priority: SimTask["priority"] }
  | { type: "TOGGLE_TASK"; taskId: string }
  | { type: "ADD_EVENT"; matterId: string | null; subject: string; location: string; start: string; end: string }
  | { type: "ADD_TIME_ENTRY"; entry: Omit<SimTimeEntry, "id" | "createdBySim"> }
  | { type: "ADD_DISBURSEMENT"; entry: Omit<SimDisbursement, "id" | "createdBySim"> }
  | { type: "CREATE_MATTER"; draft: NewMatterDraft }
  | { type: "SET_STAGE"; matterId: string; stage: MatterStage }
  | { type: "SET_NEXT_STEP"; matterId: string; nextStep: string; date: string }
  | { type: "UPDATE_MATTER"; matterId: string; patch: Partial<SimMatter>; section: string }
  | { type: "SEND_MESSAGE"; withStaff: string; matterId: string | null; body: string }
  | {
      type: "ADD_CONTACT";
      name: string;
      organisation: string;
      category: string;
      email: string;
      phone: string;
    }
  | {
      type: "ADD_PHONE_MESSAGE";
      matterId: string | null;
      caller: string;
      callerPhone: string;
      summary: string;
      forStaff: string;
    }
  | { type: "ADD_DOCUMENT"; matterId: string; name: string; source: string }
  | { type: "ADD_EMAIL"; matterId: string; to: string; subject: string; body: string }
  | { type: "OPEN_CREATE_LEAD" }
  | { type: "CREATE_LEAD"; draft: NewLeadDraft }
  | { type: "OPEN_LEAD"; leadId: string }
  | { type: "CLOSE_LEAD" }
  | { type: "SET_LEAD_STATUS"; leadId: string; status: LeadStatus }
  | { type: "CONVERT_LEAD"; leadId: string }
  | { type: "APPLY_WORKFLOW"; matterId: string; workflowId: string }
  | { type: "SEARCH"; query: string }
  | { type: "RESET" };

/** Adds days to an ISO date, returning an ISO date. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Resolves a workflow task's due rule against the matter it is applied to. */
export function resolveDueDate(
  rule: WorkflowDueRule,
  matterOpened: string,
  settlementDate: string | null,
): string | null {
  switch (rule.kind) {
    case "days-after-open":
      return addDays(matterOpened, rule.days);
    case "days-before-settlement":
      return settlementDate ? addDays(settlementDate, -rule.days) : null;
    case "on-settlement":
      return settlementDate;
    default:
      return null;
  }
}

export function describeDueRule(rule: WorkflowDueRule): string {
  switch (rule.kind) {
    case "days-after-open":
      return rule.days + " day" + (rule.days === 1 ? "" : "s") + " after the matter is opened";
    case "days-before-settlement":
      return rule.days + " days before settlement";
    case "on-settlement":
      return "On settlement";
    default:
      return "No due date";
  }
}

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-sim-${idCounter}`;
}

function logEntry(
  type: SimLogType,
  matterId: string | null,
  detail: SimLogEntry["detail"] = {},
): SimLogEntry {
  idCounter += 1;
  return { id: `log-${idCounter}`, type, at: idCounter, matterId, detail };
}

function withLog(state: SimState, entry: SimLogEntry): SimState {
  return { ...state, log: [...state.log, entry] };
}

/** "2026-08-19" -> "19/08/2026" */
export function formatAuDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "2026-08-18 3:55 PM" -> "18/08/2026 3:55 PM" */
export function formatAuDateTime(value: string): string {
  const [date, ...rest] = value.split(" ");
  const formatted = /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatAuDate(date) : date;
  return [formatted, ...rest].join(" ");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-08-19" -> "Wednesday, 19 August 2026" */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatMoney(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case "NAV_RAIL":
      return withLog(
        { ...state, nav: { ...state.nav, screen: "home", rail: action.rail } },
        logEntry("nav.rail", null, { rail: action.rail }),
      );

    case "NAV_HOME_MENU": {
      // The MESSAGES / TIME & DISBURSEMENTS menus each show their own body,
      // so switching menu also implies leaving whatever rail page was open.
      const rail: HomeRail =
        action.menu === "time" ? "activity" : action.menu === "messages" ? "dashboard" : state.nav.rail;
      return withLog(
        { ...state, nav: { ...state.nav, screen: "home", homeMenu: action.menu, rail } },
        logEntry("nav.home-menu", null, { menu: action.menu }),
      );
    }

    case "NAV_MATTER_FOLDER":
      return { ...state, nav: { ...state.nav, rail: "matters", matterFolder: action.folder } };

    case "NAV_TIME_SUBTAB":
      return { ...state, nav: { ...state.nav, timeSubTab: action.subTab } };

    case "OPEN_MATTER":
      return withLog(
        {
          ...state,
          nav: { ...state.nav, screen: "matter", matterId: action.matterId, matterTab: "matter" },
        },
        logEntry("nav.matter.open", action.matterId, {}),
      );

    case "CLOSE_MATTER":
      return { ...state, nav: { ...state.nav, screen: "home", matterId: null } };

    case "MATTER_TAB":
      return withLog(
        { ...state, nav: { ...state.nav, matterTab: action.tab } },
        logEntry("nav.matter.tab", state.nav.matterId, { tab: action.tab }),
      );

    case "OPEN_CREATE_MATTER":
      return withLog(
        { ...state, nav: { ...state.nav, screen: "create-matter" } },
        logEntry("nav.create-matter", null, {}),
      );

    case "ADD_MEMO": {
      const memo: SimMemo = {
        id: nextId("mo"),
        matterId: action.matterId,
        title: action.title,
        body: action.body,
        createdAt: `${SIM_TODAY} 2:00 PM`,
        authorInitials: state.user.initials,
        createdBySim: true,
      };
      return withLog(
        {
          ...state,
          memos: [memo, ...state.memos],
          activities: [
            {
              id: nextId("a"),
              matterId: action.matterId,
              kind: "Memo",
              time: `${SIM_TODAY} 2:00 PM`,
              description: `Memo created — ${action.title}`,
              hours: 0.05,
              hasTimeEntry: false,
            },
            ...state.activities,
          ],
        },
        logEntry("memo.add", action.matterId, { title: action.title, body: action.body }),
      );
    }

    case "ADD_TASK": {
      const task: SimTask = {
        id: nextId("t"),
        matterId: action.matterId,
        name: action.name,
        category: action.category,
        dueOn: action.dueOn,
        completedOn: null,
        assignedTo: state.user.name,
        assignedBy: state.user.name,
        priority: action.priority,
        createdBySim: true,
      };
      return withLog(
        { ...state, tasks: [...state.tasks, task] },
        logEntry("task.add", action.matterId, { name: action.name, dueOn: action.dueOn }),
      );
    }

    case "TOGGLE_TASK": {
      const target = state.tasks.find((t) => t.id === action.taskId);
      if (!target) return state;
      const completing = target.completedOn === null;
      return withLog(
        {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === action.taskId ? { ...t, completedOn: completing ? SIM_TODAY : null } : t,
          ),
        },
        logEntry("task.complete", target.matterId, {
          name: target.name,
          taskId: target.id,
          completed: completing,
        }),
      );
    }

    case "ADD_EVENT": {
      const event: SimEvent = {
        id: nextId("ev"),
        matterId: action.matterId,
        subject: action.subject,
        location: action.location,
        start: action.start,
        end: action.end,
        calendar: state.user.name,
        createdBySim: true,
      };
      return withLog(
        { ...state, events: [...state.events, event] },
        logEntry("event.add", action.matterId, { subject: action.subject, start: action.start }),
      );
    }

    case "ADD_TIME_ENTRY": {
      const entry: SimTimeEntry = { ...action.entry, id: nextId("te"), createdBySim: true };
      return withLog(
        {
          ...state,
          timeEntries: [entry, ...state.timeEntries],
          matters: state.matters.map((m) =>
            m.id === entry.matterId
              ? {
                  ...m,
                  billing: {
                    ...m.billing,
                    unbilled: m.billing.unbilled + entry.amountExGst,
                    unbilledIncGst: m.billing.unbilledIncGst + entry.amountExGst + entry.gst,
                  },
                }
              : m,
          ),
        },
        logEntry("time.add", entry.matterId, {
          subject: entry.subject,
          activityCode: entry.activityCode,
          amountExGst: entry.amountExGst,
          billable: entry.billable,
          hours: entry.hours,
        }),
      );
    }

    case "ADD_DISBURSEMENT": {
      const entry: SimDisbursement = { ...action.entry, id: nextId("db"), createdBySim: true };
      return withLog(
        { ...state, disbursements: [entry, ...state.disbursements] },
        logEntry("disbursement.add", entry.matterId, {
          subject: entry.subject,
          activityCode: entry.activityCode,
          amountExGst: entry.amountExGst,
        }),
      );
    }

    case "CREATE_MATTER": {
      const d = action.draft;
      const highest = state.matters.reduce((max, m) => Math.max(max, Number(m.number)), 0);
      const autoNumber = String(highest + 1).padStart(6, "0");
      const number = d.internalReference.trim() || autoNumber;
      const toInitials = (name: string) =>
        name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
      const matter: SimMatter = {
        id: nextId("m"),
        number,
        type: d.type ?? "Purchase",
        clientName: d.clientName,
        clientEmail: d.clientEmail,
        clientPhone: d.clientPhone,
        otherPartyName: d.otherPartyName,
        otherPartySolicitor: d.otherPartySolicitor,
        otherPartySolicitorContact: "",
        propertyAddress: d.propertyAddress,
        titleReference: d.titleReference,
        stage: "Matter Preparation",
        status: "Open",
        settlementDate: d.settlementDate || null,
        purchasePrice: d.purchasePrice ? Number(d.purchasePrice.replace(/[^0-9.]/g, "")) : null,
        depositPaid: null,
        feeEarnerInitials: d.personResponsible
          ? toInitials(d.personResponsible)
          : state.user.initials,
        assistantInitials: d.personAssisting
          ? toInitials(d.personAssisting)
          : state.user.initials,
        amlComplete: d.amlComplete,
        riskRating: d.riskRating,
        billing: { trustBalance: 0, unbilled: 0, unbilledIncGst: 0, unpaid: 0 },
        nextStep: null,
        nextStepDate: null,
        createdAt: d.matterOpened || SIM_TODAY,
        createdBySim: true,
        state: d.state,
        areaOfLaw: d.areaOfLaw ?? "Conveyancing",
        internalReference: number,
        reLine: d.reLine,
        matterDescription: d.matterDescription,
        clientRole: d.clientRole,
        personResponsible: d.personResponsible,
        personAssisting: d.personAssisting,
        introducer: d.introducer,
        referralType: d.referralType,
        referrer: d.referrer,
        debtor: d.debtor || d.clientName,
        billingType: d.billingType,
        feeEstimate: d.feeEstimate ? Number(d.feeEstimate.replace(/[^0-9.]/g, "")) : null,
        billingUnits: d.billingUnits,
        billingFrequency: d.billingFrequency,
        hourlyRate: d.hourlyRate ? Number(d.hourlyRate.replace(/[^0-9.]/g, "")) : null,
      };
      return withLog(
        {
          ...state,
          matters: [matter, ...state.matters],
          activities: [
            {
              id: nextId("a"),
              matterId: matter.id,
              kind: "Matter Opened",
              time: `${SIM_TODAY} 2:00 PM`,
              description: "Matter opened",
              hours: 0,
              hasTimeEntry: false,
            },
            ...state.activities,
          ],
          nav: { ...state.nav, screen: "matter", matterId: matter.id, matterTab: "matter" },
        },
        logEntry("matter.create", matter.id, {
          number: matter.number,
          type: matter.type,
          state: matter.state ?? null,
          areaOfLaw: matter.areaOfLaw ?? null,
          clientName: matter.clientName,
          clientRole: matter.clientRole ?? null,
          propertyAddress: matter.propertyAddress,
          riskRating: matter.riskRating,
          amlComplete: matter.amlComplete,
          personResponsible: matter.personResponsible ?? null,
          billingType: matter.billingType ?? null,
        }),
      );
    }

    case "SET_STAGE":
      return withLog(
        {
          ...state,
          matters: state.matters.map((m) =>
            m.id === action.matterId ? { ...m, stage: action.stage } : m,
          ),
        },
        logEntry("matter.stage", action.matterId, { stage: action.stage }),
      );

    case "SET_NEXT_STEP":
      return withLog(
        {
          ...state,
          matters: state.matters.map((m) =>
            m.id === action.matterId
              ? { ...m, nextStep: action.nextStep, nextStepDate: action.date }
              : m,
          ),
        },
        logEntry("matter.next-step", action.matterId, { nextStep: action.nextStep }),
      );

    case "UPDATE_MATTER": {
      const target = state.matters.find((m) => m.id === action.matterId);
      if (!target) return state;
      return withLog(
        {
          ...state,
          matters: state.matters.map((m) =>
            m.id === action.matterId ? { ...m, ...action.patch } : m,
          ),
          activities: [
            {
              id: nextId("a"),
              matterId: action.matterId,
              kind: "Matter Administration",
              time: `${SIM_TODAY} 2:00 PM`,
              description: `${action.section} updated`,
              hours: 0.02,
              hasTimeEntry: false,
            },
            ...state.activities,
          ],
        },
        logEntry("matter.update", action.matterId, {
          section: action.section,
          fields: Object.keys(action.patch).join(","),
        }),
      );
    }

    case "SEND_MESSAGE":
      return withLog(
        {
          ...state,
          messages: [
            ...state.messages,
            {
              id: nextId("ms"),
              withStaff: action.withStaff,
              matterId: action.matterId,
              from: state.user.name,
              body: action.body,
              sentAt: `${SIM_TODAY} 2:00 PM`,
              createdBySim: true,
            },
          ],
        },
        logEntry("message.send", action.matterId, { withStaff: action.withStaff, body: action.body }),
      );

    case "ADD_CONTACT": {
      const contact: SimContact = {
        id: nextId("c"),
        name: action.name,
        type: action.organisation && action.organisation === action.name ? "organisation" : "person",
        organisation: action.organisation,
        category: action.category,
        email: action.email,
        phone: action.phone,
        address: "",
        // A brand-new contact has never been risk assessed — the simulator
        // never quietly marks compliance work as done.
        riskAssessment: "Incomplete",
        createdBySim: true,
      };
      return withLog(
        { ...state, contacts: [contact, ...state.contacts] },
        logEntry("contact.add", null, { name: action.name, category: action.category }),
      );
    }

    case "ADD_PHONE_MESSAGE": {
      const message: SimPhoneMessage = {
        id: nextId("pm"),
        matterId: action.matterId,
        caller: action.caller,
        callerPhone: action.callerPhone,
        summary: action.summary,
        takenBy: state.user.name,
        forStaff: action.forStaff,
        takenAt: `${SIM_TODAY} 2:00 PM`,
        createdBySim: true,
      };
      return withLog(
        { ...state, phoneMessages: [message, ...state.phoneMessages] },
        logEntry("phone-message.add", action.matterId, {
          caller: action.caller,
          summary: action.summary,
        }),
      );
    }

    case "ADD_DOCUMENT": {
      const doc: SimDocument = {
        id: nextId("d"),
        matterId: action.matterId,
        parentId: null,
        name: action.name,
        kind: "docx",
        from: state.user.firm,
        to: "",
        dateModified: SIM_TODAY,
        sizeLabel: "42 KB",
        staffInitials: state.user.initials,
      };
      return withLog(
        {
          ...state,
          documents: [doc, ...state.documents],
          activities: [
            {
              id: nextId("a"),
              matterId: action.matterId,
              kind: "Document",
              time: `${SIM_TODAY} 2:00 PM`,
              description: `${action.name} — ${action.source}`,
              hours: 0.05,
              hasTimeEntry: false,
            },
            ...state.activities,
          ],
        },
        logEntry("document.add", action.matterId, { name: action.name, source: action.source }),
      );
    }

    case "ADD_EMAIL": {
      const email: SimEmail = {
        id: nextId("e"),
        matterId: action.matterId,
        direction: "Sent",
        from: `${state.user.name.split(" ")[0].toLowerCase()}@cremorneconveyancing.example`,
        to: action.to,
        subject: action.subject,
        date: `${SIM_TODAY} 2:00 PM`,
        body: action.body,
        hasAttachment: false,
      };
      return withLog(
        {
          ...state,
          emails: [email, ...state.emails],
          activities: [
            {
              id: nextId("a"),
              matterId: action.matterId,
              kind: "Email",
              time: `${SIM_TODAY} 2:00 PM`,
              description: `Email sent — ${action.subject}`,
              hours: 0.05,
              hasTimeEntry: false,
            },
            ...state.activities,
          ],
        },
        logEntry("email.send", action.matterId, { to: action.to, subject: action.subject, body: action.body }),
      );
    }

    case "OPEN_CREATE_LEAD":
      return { ...state, nav: { ...state.nav, screen: "create-lead" } };

    case "CREATE_LEAD": {
      const d = action.draft;
      const lead: SimLead = {
        id: nextId("l"),
        // Leads carry no reference number unless the firm enables it.
        number: null,
        leadType: d.leadType ?? "Purchase",
        state: d.state,
        clientName: d.clientName,
        clientEmail: d.clientEmail,
        clientPhone: d.clientPhone,
        otherPartyName: "Not yet known",
        propertyAddress: d.propertyAddress,
        personResponsible: d.personResponsible || state.user.name,
        referralType: d.referralType,
        referrer: d.referrer,
        estimatedFee: d.estimatedFee ? Number(d.estimatedFee.replace(/[^0-9.]/g, "")) : null,
        notes: d.notes,
        status: "Open",
        createdAt: SIM_TODAY,
        convertedMatterId: null,
        createdBySim: true,
      };
      return withLog(
        {
          ...state,
          leads: [lead, ...state.leads],
          nav: { ...state.nav, screen: "lead", leadId: lead.id },
        },
        logEntry("lead.create", null, {
          clientName: lead.clientName,
          leadType: lead.leadType,
          propertyAddress: lead.propertyAddress,
        }),
      );
    }

    case "OPEN_LEAD":
      return withLog(
        { ...state, nav: { ...state.nav, screen: "lead", leadId: action.leadId } },
        logEntry("lead.open", null, { leadId: action.leadId }),
      );

    case "CLOSE_LEAD":
      return { ...state, nav: { ...state.nav, screen: "home", leadId: null } };

    case "SET_LEAD_STATUS":
      return {
        ...state,
        leads: state.leads.map((l) =>
          l.id === action.leadId ? { ...l, status: action.status } : l,
        ),
      };

    case "CONVERT_LEAD": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead || lead.status === "Converted") return state;
      const highest = state.matters.reduce((max, m) => Math.max(max, Number(m.number)), 0);
      const number = String(highest + 1).padStart(6, "0");
      const initials = (name: string) =>
        name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
      const matter: SimMatter = {
        id: nextId("m"),
        number,
        type: lead.leadType,
        clientName: lead.clientName,
        clientEmail: lead.clientEmail,
        clientPhone: lead.clientPhone,
        otherPartyName: lead.otherPartyName,
        otherPartySolicitor: "Not yet nominated",
        otherPartySolicitorContact: "",
        propertyAddress: lead.propertyAddress,
        titleReference: "",
        stage: "Matter Preparation",
        status: "Open",
        settlementDate: null,
        purchasePrice: null,
        depositPaid: null,
        feeEarnerInitials: initials(lead.personResponsible),
        assistantInitials: state.user.initials,
        // Converting a lead never carries across a verification that was never
        // done, so AML starts incomplete on the new matter.
        amlComplete: false,
        riskRating: null,
        billing: { trustBalance: 0, unbilled: 0, unbilledIncGst: 0, unpaid: 0 },
        nextStep: null,
        nextStepDate: null,
        createdAt: SIM_TODAY,
        createdBySim: true,
        state: lead.state,
        areaOfLaw: "Conveyancing",
        internalReference: number,
        reLine: lead.clientName + " \u2014 " + lead.leadType,
        matterDescription: lead.propertyAddress,
        clientRole: lead.leadType === "Sale" ? "Vendor" : "Purchaser",
        personResponsible: lead.personResponsible,
        personAssisting: state.user.name,
        introducer: "",
        referralType: lead.referralType,
        referrer: lead.referrer,
        debtor: lead.clientName,
        billingType: "Fixed Fee",
        feeEstimate: lead.estimatedFee,
        billingUnits: "6 minute units",
        billingFrequency: "On completion",
        hourlyRate: null,
      };
      return withLog(
        {
          ...state,
          matters: [matter, ...state.matters],
          leads: state.leads.map((l) =>
            l.id === action.leadId
              ? { ...l, status: "Converted" as const, convertedMatterId: matter.id }
              : l,
          ),
          activities: [
            {
              id: nextId("a"),
              matterId: matter.id,
              kind: "Matter Opened",
              time: SIM_TODAY + " 2:00 PM",
              description: "Matter opened by converting a lead",
              hours: 0,
              hasTimeEntry: false,
            },
            ...state.activities,
          ],
          nav: {
            ...state.nav,
            screen: "matter",
            matterId: matter.id,
            matterTab: "matter",
            leadId: null,
          },
        },
        logEntry("lead.convert", matter.id, {
          leadId: lead.id,
          clientName: lead.clientName,
          number: matter.number,
        }),
      );
    }

    case "APPLY_WORKFLOW": {
      const workflow = state.workflows.find((w) => w.id === action.workflowId);
      const target = state.matters.find((m) => m.id === action.matterId);
      if (!workflow || !target) return state;
      const newTasks: SimTask[] = workflow.tasks.map((t) => ({
        id: nextId("t"),
        matterId: target.id,
        name: t.name,
        category: t.category,
        dueOn: resolveDueDate(t.dueRule, target.createdAt, target.settlementDate),
        completedOn: null,
        assignedTo:
          t.assign === "Person Responsible"
            ? (target.personResponsible ?? state.user.name)
            : (target.personAssisting ?? state.user.name),
        assignedBy: state.user.name,
        priority: t.priority,
        createdBySim: true,
      }));
      return withLog(
        {
          ...state,
          tasks: [...state.tasks, ...newTasks],
          activities: [
            {
              id: nextId("a"),
              matterId: target.id,
              kind: "Matter Administration",
              time: SIM_TODAY + " 2:00 PM",
              description:
                "Workflow applied \u2014 " + workflow.name + " (" + newTasks.length + " tasks)",
              hours: 0.02,
              hasTimeEntry: false,
            },
            ...state.activities,
          ],
        },
        logEntry("workflow.apply", target.id, {
          workflow: workflow.name,
          taskCount: newTasks.length,
        }),
      );
    }

    case "SEARCH":
      // Quick Search jumps to the Search pane rather than silently doing
      // nothing, which is what the real app does.
      return withLog(
        {
          ...state,
          nav: {
            ...state.nav,
            screen: "home",
            homeMenu: "triconvey",
            rail: "search",
            searchQuery: action.query,
          },
        },
        logEntry("search", null, { query: action.query }),
      );

    case "RESET":
      return createSeedState();

    default:
      return state;
  }
}

type SimContextValue = {
  state: SimState;
  dispatch: Dispatch<SimAction>;
  /** Currently selected matter, or null on the home screen. */
  matter: SimMatter | null;
};

const SimContext = createContext<SimContextValue | null>(null);

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(simReducer, undefined, createSeedState);
  const matter = useMemo(
    () => state.matters.find((m) => m.id === state.nav.matterId) ?? null,
    [state.matters, state.nav.matterId],
  );
  const value = useMemo(() => ({ state, dispatch, matter }), [state, dispatch, matter]);
  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSim must be used inside <SimulatorProvider>");
  return ctx;
}
