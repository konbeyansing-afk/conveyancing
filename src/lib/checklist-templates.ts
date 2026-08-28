/**
 * Checklist Templates — the "reusable configuration structure" the matter
 * checklist system is built on, matching the pattern already established by
 * MATTER_WORKFLOWS in matter-stage.ts: Jurisdiction -> MatterType -> ordered
 * task list, defined once here, never hardcoded into a component.
 *
 * Every task carries a stable `key` (never the display title — titles get
 * corrected, keys don't) and the MatterStage it belongs to, which is what
 * groups tasks in the UI and what stage-gating checks against. `dependsOn`
 * references other keys *within the same template* — a task cannot be
 * marked Completed until everything it depends on is Completed or Not
 * Applicable (see src/lib/actions/checklist.ts).
 *
 * Source: sections 4-5 of the brief (QLD, given verbatim) and the NSW
 * Purchaser/Vendor spreadsheets supplied afterward. The spreadsheets'
 * matter header (client name, address, dates) was deliberately discarded —
 * only the task list itself, which contains no client-identifying
 * information, was used. A few near-duplicate lines in the QLD Vendor
 * Post-Settlement section (the source listed "Tax Invoice" beside "Final
 * Tax Invoice", and "Cremorne - post-settlement email to vendor" beside
 * "Prepare Cremorne - post-settlement email to vendor") were merged rather
 * than kept as literal duplicates — see the Matter Health panel's "no
 * duplicate tasks" check, which this avoids tripping on the app's own
 * checklist rather than the firm's real precedent list.
 */

import type { Jurisdiction, MatterStage, MatterType } from "@prisma/client";

export type ChecklistTemplateTask = {
  key: string;
  section: string;
  stage: MatterStage;
  title: string;
  /** Required tasks must be Completed or Not Applicable before the matter can move past this task's stage. Defaults to true. */
  required?: boolean;
  /** Keys of other tasks in this same template that must be Completed/Not Applicable before this one can be marked Completed. */
  dependsOn?: string[];
};

function section(name: string, stage: MatterStage, rows: [string, string, (Omit<ChecklistTemplateTask, "key" | "section" | "stage" | "title"> | undefined)?][]): ChecklistTemplateTask[] {
  return rows.map(([key, title, opts]) => ({ key, section: name, stage, title, ...opts }));
}

/* ------------------------------------------------------------------ */
/* QLD — Purchaser (source: brief section 4, verbatim task wording)     */
/* ------------------------------------------------------------------ */

const QLD_PURCHASER: ChecklistTemplateTask[] = [
  ...section("Documents", "MATTER_OPENING", [
    ["qp-matter-details", "Complete Matter Details & Verify QLD REIQ Contract Version"],
    ["qp-form2", "Draft Form 2 Seller Disclosure Statement"],
    ["qp-form2-certs", "Order Prescribed Certificates for Form 2"],
    ["qp-title-search", "Title Search"],
    ["qp-rp", "Registered Plan (RP/SP)"],
    ["qp-s205", "Section 205 Body Corporate Certificate (if Strata/Community Title)", { required: false }],
    ["qp-cms", "Community Management Statement (CMS) (if Strata/Community Title)", { required: false }],
    ["qp-pool-safety", "Pool Safety Certificate or Notice of No Pool Safety Certificate (Form 36)"],
    ["qp-cover-sheet", "Create File Cover Sheet (Sale Summary)"],
    ["qp-initial-letter", "Send Initial Letter to Client (Seller's Questionnaire & Cost Agreement)"],
    ["qp-caf", "Client Authorisation Form (CAF)"],
    ["qp-voi", "VOI (Verification of Identity) Instructions"],
    ["qp-discharge-authority", "Discharge Authority Form for outgoing mortgage (if applicable)", { required: false }],
  ]),
  { key: "qp-diary-dates", section: "Critical Dates / Document Follow-Up", stage: "MATTER_OPENING", title: "Diary Critical Dates in System" },
  { key: "qp-follow-up-caf-voi-discharge", section: "Critical Dates / Document Follow-Up", stage: "CONTRACT_SIGNED", title: "Follow up Client for signed CAF, VOI, and Discharge Authority" },
  { key: "qp-submit-discharge", section: "Critical Dates / Document Follow-Up", stage: "CONTRACT_SIGNED", title: "Submit Discharge Authority to Outgoing Mortgagee (Bank)", required: false },
  { key: "qp-finance-date", section: "Critical Dates / Document Follow-Up", stage: "FINANCE", title: "Finance Date" },
  { key: "qp-follow-up-finance", section: "Critical Dates / Document Follow-Up", stage: "FINANCE", title: "Follow up Purchaser's Solicitor (PSOL) for Finance Approval Confirmation" },
  { key: "qp-bp-date", section: "Critical Dates / Document Follow-Up", stage: "BUILDING_PEST", title: "Building & Pest Inspection Date" },
  { key: "qp-follow-up-bp", section: "Critical Dates / Document Follow-Up", stage: "BUILDING_PEST", title: "Follow up Purchaser's Solicitor (PSOL) for B&P Confirmation" },
  { key: "qp-wait-searches", section: "Critical Dates / Document Follow-Up", stage: "SEARCHES", title: "Wait for PSOL to send Pre-Settlement Searches" },
  { key: "qp-settlement-date", section: "Critical Dates / Document Follow-Up", stage: "PRE_SETTLEMENT", title: "Settlement Date" },
  ...section("Pre-Settlement", "PRE_SETTLEMENT", [
    ["qp-receive-adjustments", "Receive and Check Settlement Adjustments from PSOL"],
    ["qp-verify-rates", "Verify Council Rates, Water Rates, Land Tax, and Body Corporate Levies against your file"],
    ["qp-approve-adjustments", "Approve Settlement Adjustments & Return to PSOL", { dependsOn: ["qp-receive-adjustments", "qp-verify-rates"] }],
    ["qp-tax-invoice", "Draft Tax Invoice"],
    ["qp-payout-figure", "Request Bank Payout Figure (Shortfall or Surplus)", { dependsOn: ["qp-approve-adjustments"] }],
    ["qp-shortfall-deposit", "If there is a shortfall, arrange for the client to deposit funds into your Trust Account", { required: false, dependsOn: ["qp-payout-figure"] }],
    ["qp-pre-settlement-email", "Send Pre-Settlement Email to Vendor"],
    ["qp-attach-final-statement", "Attach Final Settlement Statement & Invoice"],
    ["qp-attach-trust-details", "Attach Trust Account details (if applicable)", { required: false }],
    ["qp-order-on-agent", "Prepare Order on the Agent"],
  ]),
  ...section("PEXA", "PEXA", [
    ["qp-pexa-accept-invite", "Accept PEXA Workspace Invitation from PSOL"],
    ["qp-pexa-verify-parties", "Check / Verify PEXA Parties & Roles", { dependsOn: ["qp-pexa-accept-invite"] }],
    ["qp-pexa-verify-mortgagee", "Verify Mortgagee on Title (Outgoing Bank) has joined PEXA", { dependsOn: ["qp-pexa-accept-invite"] }],
    ["qp-pexa-sign-caf", "Sign Client Authorisation Form in PEXA", { dependsOn: ["qp-pexa-accept-invite", "qp-pexa-verify-parties"] }],
    ["qp-form24", "Check Form 24 (Property Information Transfer) details (Part B - Vendor)"],
    ["qp-vendor-payment-destinations", "Input Vendor Payment Destinations"],
    [
      "qp-pexa-sign-workspace",
      "Sign PEXA Workspace / Transfer Documents",
      { dependsOn: ["qp-pexa-accept-invite", "qp-pexa-verify-parties", "qp-pexa-verify-mortgagee", "qp-pexa-sign-caf"] },
    ],
  ]),
  ...section("Post-Settlement", "POST_SETTLEMENT", [
    ["qp-confirm-settlement", "Call/Email Client to confirm Settlement is Complete"],
    ["qp-order-on-agent-send", "Email Order on the Agent to the Real Estate Agent (Authorising key release)"],
    ["qp-final-invoice", "Generate Final Tax Invoice and apply Trust Monies"],
    ["qp-post-settlement-email", "Send Post-Settlement Email to Vendor"],
    ["qp-attach-final-statement-2", "Attach Final Settlement Statement"],
    ["qp-attach-paid-invoice", "Attach Paid Tax Invoice"],
  ]),
  { key: "qp-close-archive", section: "Post-Settlement", stage: "MATTER_FINALISATION", title: "Close and Archive File" },
];

/* ------------------------------------------------------------------ */
/* QLD — Vendor (source: brief section 5, verbatim task wording)        */
/* ------------------------------------------------------------------ */

const QLD_VENDOR: ChecklistTemplateTask[] = [
  ...section("Documents", "MATTER_OPENING", [
    ["qv-matter-details", "Complete Matter Details"],
    ["qv-check-strata", "Check if Strata"],
    ["qv-add-strata-manager", "Make sure to add strata manager (matter settings)", { required: false }],
    ["qv-new-purchase-info", "Check New Purchase Information"],
    ["qv-cover-sheet", "Create File Cover Sheet (File Cover Sheet - Purchase / summary version)"],
    ["qv-check-requisitions", "Check if requisitions on title is in the contract"],
    ["qv-requisitions", "Requisitions / Replies to Requisitions"],
    ["qv-send-s47", "Send to PSOL - S47"],
    ["qv-send-s184", "Send to PSOL - S184"],
    ["qv-wait-s22", "If Strata - Wait for the S22 from PSOL to Sign", { required: false }],
    ["qv-s22-received", "PSOL signed S22 - RECEIVED?", { required: false, dependsOn: ["qv-wait-s22"] }],
    ["qv-s22-countersigned-sent", "PSOL counter signed S22 - SENT?", { required: false, dependsOn: ["qv-s22-received"] }],
    ["qv-order-s184", "Order S184 (if instructed)", { required: false }],
    ["qv-s184-payment", "S184 payment - sent", { required: false, dependsOn: ["qv-order-s184"] }],
    ["qv-s184-received", "S184 certificate - RECEIVED?", { required: false, dependsOn: ["qv-s184-payment"] }],
    ["qv-s184-sent-psol", "S184 Certificate - SENT TO PSOL?", { required: false, dependsOn: ["qv-s184-received"] }],
    ["qv-pexa-create", "Create PEXA Workspace"],
    ["qv-pexa-invite", "PEXA - Created parties, send invites", { dependsOn: ["qv-pexa-create"] }],
    ["qv-check-documents", "Check Documents"],
    ["qv-transfer-notice", "Transfer / Notice of Sale"],
  ]),
  ...section("Post-Exchange", "CONTRACT_SIGNED", [
    ["qv-draft-replies", "Draft replies to requisitions"],
    ["qv-order-s47-landtax", "Order S47 / Land tax"],
    ["qv-order-s184-instruction", "Order S184 (as per instruction)"],
    ["qv-post-exchange-letter", "Cremorne - Post Exchange Letter to Client"],
    ["qv-follow-up-authority", "Check / Follow up Authority Form"],
    ["qv-event-post-exchange", "Set Event (1 week) for Post Exchange follow up"],
    ["qv-event-vsol-docs", "Set Event (1 week) for VSOLs docs follow up"],
    ["qv-countersigned-s22", "Counter signed S22 / ATO / S47 / S184"],
    ["qv-event-stamp-duty", "Set Event (2 week) before settlement / Stamp Duty"],
    ["qv-prepare-presmt", "Prepare Pre-SMT and check other docs"],
    ["qv-check-client-docs", "Check docs from client"],
    ["qv-post-exchange-docs-received", "Post Exchange Docs - RECEIVED?"],
    ["qv-order-edr", "Order EDR once available"],
    ["qv-upload-edr", "Upload EDR in PEXA then check docs", { dependsOn: ["qv-order-edr", "qv-pexa-create"] }],
  ]),
  ...section("Documents Confirmed", "SEARCHES", [
    ["qv-signed-exchange-on-file", "Signed Exchange Docs are on file"],
    ["qv-searches-on-file", "All searches are on file"],
  ]),
  ...section("Pre-Settlement", "PRE_SETTLEMENT", [
    ["qv-order-on-agent-open", "Open and save it on the matter - Addressed to Vendor's Agent"],
    ["qv-letter-order-agent", "Letter to Agent with Order on the Agent"],
    ["qv-authorise-key-release", "Vendor authorising agent to release the keys to the purchaser"],
    ["qv-adjustment-sheet", "Prepare Settlement Adjustment Sheet"],
    ["qv-tax-invoice", "Draft Tax Invoice"],
    ["qv-presmt-email", "Cremorne - Pre-settlement email to vendor with statement and invoice", { dependsOn: ["qv-adjustment-sheet", "qv-tax-invoice"] }],
    ["qv-presmt-email-client", "Create PreSMT email and send email to client"],
    ["qv-presmt-checklist", "Prepare Pre-settlement checklist for Sale"],
  ]),
  ...section("PEXA", "PEXA", [
    ["qv-parties-active", "All parties are active in PEXA"],
    ["qv-nomination", "Nomination prepared", { dependsOn: ["qv-parties-active"] }],
    ["qv-adjustments-uploaded", "Adjustments uploaded"],
    ["qv-line-destinations", "Line destinations completed", { dependsOn: ["qv-adjustments-uploaded"] }],
    ["qv-check-invites-docs", "Check PEXA - invites, parties, docs, EDR"],
    ["qv-transfer-edr", "Transfer / Notice of Sale - EDR / Stamp Duty", { dependsOn: ["qv-nomination", "qv-adjustments-uploaded"] }],
    ["qv-deposit-confirmation", "Check Deposit confirmation"],
    ["qv-check-countersigned", "Check - Counter signed S22 / ATO / S47 / S184"],
  ]),
  ...section("Post-Settlement", "POST_SETTLEMENT", [
    ["qv-final-invoice", "Final Tax Invoice"],
    ["qv-final-statement", "Final Settlement Statement"],
    ["qv-post-settlement-email", "Prepare Cremorne - post-settlement email to vendor with statement and invoice", { dependsOn: ["qv-final-invoice", "qv-final-statement"] }],
  ]),
  { key: "qv-close-archive", section: "Post-Settlement", stage: "MATTER_FINALISATION", title: "Close / Archive File" },
];

/* ------------------------------------------------------------------ */
/* NSW — Purchaser (source: NSW Purchaser Checklist spreadsheet;        */
/* header/matter details discarded, task text only)                     */
/* ------------------------------------------------------------------ */

const NSW_PURCHASER: ChecklistTemplateTask[] = [
  ...section("Documents", "MATTER_OPENING", [
    ["np-matter-details", "Complete Matter Details"],
    ["np-check-strata", "Check if Strata — make sure to add strata manager (matter settings)", { required: false }],
    ["np-new-purchase-info", "Check New Purchase Information"],
    ["np-cover-sheet", "Create File Cover Sheet (File Cover Sheet - Purchase, summary version)"],
    ["np-check-requisitions", "Check if requisitions on title is on the contract"],
    ["np-email-vsol-rot", "YES - email the VSOL for their replies to RoT"],
    ["np-send-rot", "NO - Send RoT and ask for their replies"],
    ["np-replies-received", "Replies to Requisition - RECEIVED?"],
    ["np-s22-notice", "If Strata - Send S22 Notice to VSOL — ask for S47 / ATO / S184", { required: false }],
    ["np-s22-countersigned-received", "Counter signed S22 / ATO / S47 / S184 - RECEIVED?", { required: false, dependsOn: ["np-s22-notice"] }],
    ["np-searches", "Order stat enquiries - 6 Searches (Council s603, Sydney Water s66, CRR Rail/Road/Electricity, council outstanding notices)"],
    ["np-order-s184", "Order S184 (JT's instruction)", { required: false }],
    ["np-s184-payment", "S184 payment sent", { required: false, dependsOn: ["np-order-s184"] }],
    ["np-s184-received", "S184 certificate - RECEIVED?", { required: false, dependsOn: ["np-s184-payment"] }],
    ["np-pexa-create", "Create PEXA Workspace"],
    ["np-pexa-invite", "PEXA - Created parties, send invites", { dependsOn: ["np-pexa-create"] }],
    ["np-check-documents", "Check Documents"],
    ["np-transfer-notice", "Transfer / Notice of Sale"],
  ]),
  ...section("Post Exchange Docs", "CONTRACT_EXCHANGE", [
    ["np-post-exchange-sent", "Post Exchange Docs sent to client (Post Exchange Letter, Client Authorisation, Purchaser/Transferee Declaration, Scantek Brochure, current Aus Post VOI form)"],
    ["np-fhb-docs", "If First Home Buyer, add FHB docs from precedents and FHB identity factsheet", { required: false }],
    ["np-check-loan-approval", "Check for the Loan Approval if w/ Finance", { required: false }],
    ["np-event-post-exchange", "Set Event (1 week) for Post Exchange follow up — CA, CAF, PurDecForm, VOI"],
    ["np-event-vsol-docs", "Set Event (1 week) for VSOL's docs follow up — Counter signed S22 / ATO / S47 / S184"],
    ["np-event-stamp-duty", "Set Event (2 weeks before settlement) Stamp Duty — Prepare Pre-SMT 10 days before, check docs from client/VSOL/PEXA 1 week before"],
    ["np-post-exchange-received", "Post Exchange Docs - RECEIVED?"],
    ["np-order-edr", "Order EDR once we have the VOI and Purchaser Declaration Form"],
    ["np-upload-edr", "Upload EDR in PEXA then check docs", { dependsOn: ["np-order-edr", "np-pexa-create"] }],
  ]),
  ...section("Documents Confirmed", "SEARCHES", [
    ["np-signed-exchange-on-file", "Signed Exchange Docs are on file"],
    ["np-searches-on-file", "All searches are on file"],
  ]),
  ...section("Pre-Settlement", "PRE_SETTLEMENT", [
    ["np-order-on-agent", "Open and save Order on the Agent — purchaser authorising the agent to release any deposit held to the vendor"],
    ["np-tax-invoice", "Draft Tax Invoice"],
    ["np-presmt-checklist", "Prepare Pre-Settlement checklist for Purchase"],
    ["np-adjustment-sheet", "Prepare Settlement Adjustment Sheet"],
    ["np-presmt-email-draft", "Create Pre-Settlement email - send email to client", { dependsOn: ["np-adjustment-sheet"] }],
    ["np-settlement-booking-email", "Send email to client — settlement booking confirmation", { dependsOn: ["np-presmt-email-draft"] }],
  ]),
  ...section("PEXA", "PEXA", [
    ["np-parties-active", "All parties are active in PEXA"],
    ["np-nomination", "Nomination prepared", { dependsOn: ["np-parties-active"] }],
    ["np-adjustments-uploaded", "Adjustments uploaded"],
    ["np-line-destinations", "Line destinations completed", { dependsOn: ["np-adjustments-uploaded"] }],
    [
      "np-check-invites-docs",
      "Check PEXA — invites, parties, docs, EDR (transfer / notice of sale / EDR stamp duty)",
      { dependsOn: ["np-nomination", "np-line-destinations"] },
    ],
    ["np-check-loan-approval-pexa", "Check Loan Approval", { required: false }],
    ["np-deposit-confirmation", "Check Deposit confirmation"],
    ["np-check-countersigned", "Check — Counter signed S22 / ATO / S47 / S184"],
  ]),
  ...section("Post-Settlement", "POST_SETTLEMENT", [
    ["np-final-invoice", "Final Tax Invoice"],
    ["np-ltr-purchaser", "Prepare letter to Purchaser after settlement"],
    ["np-final-statement", "Prepare letter — Final Settlement Statement", { dependsOn: ["np-final-invoice"] }],
    ["np-s22-strata-manager", "Send signed S22 to strata manager, following settlement", { required: false }],
  ]),
];

/* ------------------------------------------------------------------ */
/* NSW — Vendor (source: NSW Vendor Checklist spreadsheet; header/      */
/* matter details discarded, task text only)                            */
/* ------------------------------------------------------------------ */

const NSW_VENDOR: ChecklistTemplateTask[] = [
  ...section("Documents", "MATTER_OPENING", [
    ["nv-matter-details", "Complete Matter Details"],
    ["nv-check-strata", "Check if Strata — make sure to add strata manager (matter settings)", { required: false }],
    ["nv-new-purchase-info", "Check New Purchase Information"],
    ["nv-cover-sheet", "Create File Cover Sheet (File Cover Sheet - Purchase, summary version)"],
    ["nv-check-requisitions", "Check if requisitions on title is in the contract"],
    ["nv-wait-rot", "NO - Wait for PSOL to send the RoT"],
    ["nv-replies-sent", "Replies to Requisition - SENT?", { dependsOn: ["nv-wait-rot"] }],
    ["nv-send-s47", "Send to PSOL - S47"],
    ["nv-send-ato", "Send to PSOL - ATO"],
    ["nv-send-s184", "Send to PSOL - S184"],
    ["nv-wait-s22", "If Strata - Wait for the S22 from PSOL to Sign", { required: false }],
    ["nv-s22-received", "PSOL signed S22 - RECEIVED?", { required: false, dependsOn: ["nv-wait-s22"] }],
    ["nv-s22-countersigned-sent", "PSOL counter signed S22 - SENT?", { required: false, dependsOn: ["nv-s22-received"] }],
    ["nv-order-s184", "Order S184 (JT's instruction)", { required: false }],
    ["nv-s184-payment", "S184 payment sent", { required: false, dependsOn: ["nv-order-s184"] }],
    ["nv-s184-received", "S184 certificate - RECEIVED?", { required: false, dependsOn: ["nv-s184-payment"] }],
    ["nv-s184-sent-psol", "S184 Certificate - SENT TO PSOL?", { required: false, dependsOn: ["nv-s184-received"] }],
    ["nv-pexa-create", "Create PEXA Workspace"],
    ["nv-pexa-invite", "PEXA - Created parties, send invites", { dependsOn: ["nv-pexa-create"] }],
    ["nv-check-documents", "Check Documents"],
    ["nv-transfer-notice", "Transfer / Notice of Sale"],
  ]),
  ...section("Post Exchange Docs", "CONTRACT_EXCHANGE", [
    ["nv-draft-replies", "Draft replies to requisitions"],
    ["nv-order-s47-landtax", "Order S47 / Land tax"],
    ["nv-order-s184-instruction", "Order S184 (as per instruction)"],
    ["nv-post-exchange-letter", "Cremorne - Post Exchange Letter to Client"],
    ["nv-discharge-authority", "Check for Discharge Authority Form", { required: false }],
    ["nv-event-post-exchange", "Set Event (1 week) for Post Exchange follow up — CA, CAF, PurDecForm, VOI"],
    ["nv-event-vsol-docs", "Set Event (1 week) for VSOL's docs follow up — Counter signed S22 / ATO / S47 / S184"],
    ["nv-event-stamp-duty", "Set Event (2 weeks before settlement) Stamp Duty — Prepare Pre-SMT 10 days before, check docs from client/VSOL/PEXA 1 week before"],
    ["nv-post-exchange-received", "Post Exchange Docs - RECEIVED?"],
    ["nv-order-edr", "Order EDR once we have the VOI and Purchaser Declaration Form"],
    ["nv-upload-edr", "Upload EDR in PEXA then check docs", { dependsOn: ["nv-order-edr", "nv-pexa-create"] }],
  ]),
  ...section("Documents Confirmed", "SEARCHES", [
    ["nv-signed-exchange-on-file", "Signed Exchange Docs are on file"],
    ["nv-searches-on-file", "All searches are on file"],
  ]),
  ...section("Pre-Settlement", "PRE_SETTLEMENT", [
    ["nv-order-on-agent", "Open and save Order on the Agent — Vendor authorising agent to release the keys to the purchaser"],
    ["nv-adjustment-sheet", "Prepare Settlement Adjustment Sheet"],
    ["nv-tax-invoice", "Draft Tax Invoice"],
    ["nv-presmt-email", "Pre-settlement email to vendor with statement and invoice", { dependsOn: ["nv-adjustment-sheet", "nv-tax-invoice"] }],
    ["nv-presmt-checklist", "Prepare Pre-Settlement checklist for Sale"],
  ]),
  ...section("PEXA", "PEXA", [
    ["nv-parties-active", "All parties are active in PEXA"],
    ["nv-nomination", "Nomination prepared", { dependsOn: ["nv-parties-active"] }],
    ["nv-adjustments-uploaded", "Adjustments uploaded"],
    ["nv-line-destinations", "Line destinations completed", { dependsOn: ["nv-adjustments-uploaded"] }],
    [
      "nv-check-invites-docs",
      "Check PEXA — invites, parties, docs, EDR (transfer / notice of sale / EDR stamp duty)",
      { dependsOn: ["nv-nomination", "nv-line-destinations"] },
    ],
    ["nv-deposit-confirmation", "Check Deposit confirmation"],
    ["nv-check-countersigned", "Check — Counter signed S22 / ATO / S47 / S184"],
  ]),
  ...section("Post-Settlement", "POST_SETTLEMENT", [
    ["nv-final-invoice", "Final Tax Invoice"],
    ["nv-final-statement", "Final Settlement Statement"],
    ["nv-post-settlement-email", "Post-settlement email to vendor with Settlement Adjustment Sheet and Tax Invoice attached", { dependsOn: ["nv-final-invoice", "nv-final-statement"] }],
  ]),
];

export const CHECKLIST_TEMPLATES: Record<Jurisdiction, Record<MatterType, ChecklistTemplateTask[]>> = {
  QLD: { PURCHASE: QLD_PURCHASER, SALE: QLD_VENDOR },
  NSW: { PURCHASE: NSW_PURCHASER, SALE: NSW_VENDOR },
};

/** The template for a jurisdiction+matterType combination, or an empty list if none exists yet. */
export function checklistTemplate(jurisdiction: Jurisdiction, matterType: MatterType | null): ChecklistTemplateTask[] {
  if (!matterType) return [];
  return CHECKLIST_TEMPLATES[jurisdiction][matterType];
}

export function hasChecklistTemplate(jurisdiction: Jurisdiction, matterType: MatterType | null): boolean {
  return checklistTemplate(jurisdiction, matterType).length > 0;
}
