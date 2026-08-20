/**
 * Data model for the PEXA workspace simulator.
 *
 * PEXA is the electronic lodgement network Australian conveyancers settle
 * through. A transaction lives in a Workspace, which carries participants,
 * registry documents and a Financial Settlement Schedule, and tracks two
 * separate readiness bars — Lodgement and Financial Settlement. Both must
 * reach Ready ("Ready/Ready") before the workspace can settle.
 *
 * All data here is synthetic training data.
 */

/** The role a subscriber holds in a workspace; it decides what they can do. */
export type PexaRole =
  | "Incoming Proprietor"
  | "Proprietor on Title"
  | "Incoming Mortgagee"
  | "Mortgagee on Title";

export const PEXA_ROLES: PexaRole[] = [
  "Incoming Proprietor",
  "Proprietor on Title",
  "Incoming Mortgagee",
  "Mortgagee on Title",
];

/** Status shown on the Lodgement and Financial Settlement bars. */
export type PexaPrepStatus = "In Preparation" | "Prepared" | "Ready";

export type PexaWorkspaceStatus = "In Preparation" | "Ready to Book" | "Booked" | "Settled";

export type PexaJurisdiction = "NSW" | "QLD" | "VIC" | "SA" | "WA" | "TAS" | "NT" | "ACT";

export const PEXA_JURISDICTIONS: PexaJurisdiction[] = [
  "NSW",
  "QLD",
  "VIC",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
];

export type PexaParticipant = {
  id: string;
  /** The firm or financial institution — PEXA calls them Subscribers. */
  subscriberName: string;
  role: PexaRole;
  /** Invited participants must accept before they can act. */
  accepted: boolean;
  /** True for the participant this trainee is acting as. */
  isSelf: boolean;
  invitedAt: string | null;
  createdBySim?: boolean;
};

export type PexaDocumentType =
  | "Transfer"
  | "Mortgage"
  | "Discharge of Mortgage"
  | "Caveat"
  | "Withdrawal of Caveat"
  | "Notice of Sale";

export const PEXA_DOCUMENT_TYPES: PexaDocumentType[] = [
  "Transfer",
  "Mortgage",
  "Discharge of Mortgage",
  "Caveat",
  "Withdrawal of Caveat",
  "Notice of Sale",
];

export type PexaDocumentStatus = "Draft" | "Prepared" | "Signed";

export type PexaDocument = {
  id: string;
  type: PexaDocumentType;
  status: PexaDocumentStatus;
  /** Which role is responsible for preparing and signing it. */
  responsibleRole: PexaRole;
  signedBy: string | null;
  signedAt: string | null;
  createdBySim?: boolean;
};

export type FundsDirection = "Source" | "Destination";

export const SOURCE_CATEGORIES = [
  "Purchaser funds",
  "Incoming mortgage advance",
  "Deposit released",
  "Trust account",
];

export const DESTINATION_CATEGORIES = [
  "Discharge of mortgage",
  "Vendor proceeds",
  "Council rates adjustment",
  "Water rates adjustment",
  "Land tax adjustment",
  "Agent commission",
  "Duty",
  "Lodgement fee",
  "PEXA fee",
];

export type PexaFundsLine = {
  id: string;
  direction: FundsDirection;
  category: string;
  description: string;
  amount: number;
  /** Pre-populated items (duty, lodgement and PEXA fees) can't be edited. */
  locked: boolean;
  createdBySim?: boolean;
};

export type PexaNotification = {
  id: string;
  workspaceId: string;
  message: string;
  at: string;
  unread: boolean;
};

export type PexaWorkspace = {
  id: string;
  /** The PEXA workspace number practitioners quote to each other. */
  workspaceNumber: string;
  jurisdiction: PexaJurisdiction;
  titleReference: string;
  propertyAddress: string;
  /** Links the workspace back to the file in the practice management system. */
  matterNumber: string;
  /** The role our firm holds in this workspace. */
  ourRole: PexaRole;
  settlementDate: string | null;
  settlementTime: string | null;
  /** Who last proposed the date — it isn't booked until everyone accepts. */
  proposedBy: string | null;
  /** Participant ids that have accepted the proposed date and time. */
  acceptedBy: string[];
  status: PexaWorkspaceStatus;
  /** A transfer with no money moving has no financial settlement. */
  hasFinancialSettlement: boolean;
  participants: PexaParticipant[];
  documents: PexaDocument[];
  funds: PexaFundsLine[];
  createdBySim?: boolean;
};

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export type PexaScreen = "dashboard" | "workspace" | "create-workspace" | "reference";

export type PexaTab =
  | "summary"
  | "participants"
  | "documents"
  | "financial"
  | "settlement"
  | "notifications";

export type PexaNav = {
  screen: PexaScreen;
  workspaceId: string | null;
  tab: PexaTab;
};

/* ------------------------------------------------------------------ */
/* Action log                                                          */
/* ------------------------------------------------------------------ */

export type PexaLogType =
  | "nav.workspace.open"
  | "nav.tab"
  | "workspace.create"
  | "participant.invite"
  | "document.create"
  | "document.sign"
  | "funds.add"
  | "funds.remove"
  | "settlement.propose"
  | "settlement.accept"
  | "settlement.settle";

export type PexaLogEntry = {
  id: string;
  type: PexaLogType;
  at: number;
  workspaceId: string | null;
  detail: Record<string, string | number | boolean | null>;
};

export type PexaState = {
  today: string;
  user: { name: string; subscriber: string };
  workspaces: PexaWorkspace[];
  notifications: PexaNotification[];
  nav: PexaNav;
  log: PexaLogEntry[];
};

/* ------------------------------------------------------------------ */
/* Derived status                                                      */
/* ------------------------------------------------------------------ */

export function fundsTotal(ws: PexaWorkspace, direction: FundsDirection): number {
  return ws.funds
    .filter((f) => f.direction === direction)
    .reduce((sum, f) => sum + f.amount, 0);
}

/** The schedule must balance to the cent before settlement can proceed. */
export function fundsBalance(ws: PexaWorkspace): number {
  return (
    Math.round((fundsTotal(ws, "Source") - fundsTotal(ws, "Destination")) * 100) / 100
  );
}

export function isFundsBalanced(ws: PexaWorkspace): boolean {
  return ws.hasFinancialSettlement && fundsBalance(ws) === 0 && ws.funds.length > 0;
}

/** Lodgement bar: In Preparation → Prepared → Ready (all documents signed). */
export function lodgementStatus(ws: PexaWorkspace): PexaPrepStatus {
  if (ws.documents.length === 0) return "In Preparation";
  if (ws.documents.every((d) => d.status === "Signed")) return "Ready";
  if (ws.documents.some((d) => d.status !== "Draft")) return "Prepared";
  return "In Preparation";
}

/** Financial Settlement bar: Ready only once the schedule balances. */
export function financialStatus(ws: PexaWorkspace): PexaPrepStatus {
  if (!ws.hasFinancialSettlement) return "Ready";
  if (ws.funds.length === 0) return "In Preparation";
  return isFundsBalanced(ws) ? "Ready" : "Prepared";
}

/** Everyone in the workspace has accepted the proposed date and time. */
export function isDateAgreed(ws: PexaWorkspace): boolean {
  if (!ws.settlementDate) return false;
  return ws.participants.every((p) => ws.acceptedBy.includes(p.id));
}

/** "Ready/Ready" — both bars Ready, date agreed, everyone accepted. */
export function isReadyReady(ws: PexaWorkspace): boolean {
  return (
    lodgementStatus(ws) === "Ready" &&
    financialStatus(ws) === "Ready" &&
    isDateAgreed(ws) &&
    ws.participants.every((p) => p.accepted)
  );
}
