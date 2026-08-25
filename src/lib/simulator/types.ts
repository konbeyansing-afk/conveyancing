/**
 * Data model for the practice-management-system simulator.
 *
 * Everything in here is synthetic training data. No real matter, client, or
 * contact from the firm's live system is reproduced — the simulator exists so
 * trainees can practise the workflow without touching production.
 */

export type MatterType = "Purchase" | "Sale" | "Transfer" | "Survivorship Application";

/** Matches the state list on Smokeball's matter-type picker. */
export const AU_STATES = ["NSW", "QLD", "VIC", "SA", "WA", "TAS", "NT", "ACT"] as const;
export type AuState = (typeof AU_STATES)[number];

export type AreaOfLaw = "Conveyancing" | "Leasing" | "Estates";

/** Billing Type dropdown on the matter's Billing tab. */
export type BillingType = "Fixed Fee" | "Time-Based" | "Contingency" | "Non-billable";

export type MatterStatus = "Open" | "Closed" | "Deleted" | "Cancelled";

export type MatterStage =
  | "Matter Preparation"
  | "Contract Review"
  | "Post Exchange"
  | "Pre-Settlement"
  | "Post Settlement"
  | "Archived";

export const MATTER_STAGES: MatterStage[] = [
  "Matter Preparation",
  "Contract Review",
  "Post Exchange",
  "Pre-Settlement",
  "Post Settlement",
  "Archived",
];

export type RiskRating = "Low" | "Medium" | "High";

export type SimMatter = {
  id: string;
  /** Displayed matter number, e.g. "004182". */
  number: string;
  type: MatterType;
  /** Client side of the file — the person the firm acts for. */
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  /** The other side (vendor on a purchase, purchaser on a sale). */
  otherPartyName: string;
  otherPartySolicitor: string;
  otherPartySolicitorContact: string;
  propertyAddress: string;
  titleReference: string;
  stage: MatterStage;
  status: MatterStatus;
  settlementDate: string | null;
  purchasePrice: number | null;
  depositPaid: number | null;
  feeEarnerInitials: string;
  assistantInitials: string;
  amlComplete: boolean;
  riskRating: RiskRating | null;
  billing: {
    trustBalance: number;
    unbilled: number;
    unbilledIncGst: number;
    unpaid: number;
  };
  nextStep: string | null;
  nextStepDate: string | null;
  createdAt: string;

  /* Fields captured by the Create Matter wizard (Smokeball field names). */
  state?: AuState;
  areaOfLaw?: AreaOfLaw;
  /** "Internal Reference (matter number)" on the Matter Info window. */
  internalReference?: string;
  reLine?: string;
  matterDescription?: string;
  clientRole?: string;
  personResponsible?: string;
  personAssisting?: string;
  introducer?: string;
  referralType?: string;
  referrer?: string;
  debtor?: string;
  billingType?: BillingType;
  feeEstimate?: number | null;
  billingUnits?: string;
  billingFrequency?: string;
  hourlyRate?: number | null;
  /** Set on matters the trainee created inside the simulator. */
  createdBySim?: boolean;
};

export type SimEmail = {
  id: string;
  matterId: string;
  direction: "Received" | "Sent";
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  hasAttachment: boolean;
};

export type SimMemo = {
  id: string;
  matterId: string;
  title: string;
  body: string;
  createdAt: string;
  authorInitials: string;
  createdBySim?: boolean;
};

export type TaskCategory = "Uncategorized" | "Initial Work" | "Phone Message" | "Pre-Settlement";

export type SimTask = {
  id: string;
  matterId: string | null;
  name: string;
  category: TaskCategory;
  dueOn: string | null;
  completedOn: string | null;
  assignedTo: string;
  assignedBy: string;
  priority: "No Priority" | "Low" | "Medium" | "High" | "Urgent";
  createdBySim?: boolean;
};

export type SimEvent = {
  id: string;
  matterId: string | null;
  subject: string;
  location: string;
  start: string;
  end: string;
  calendar: string;
  createdBySim?: boolean;
};

export type SimDocumentKind = "folder" | "pdf" | "docx" | "email" | "image";

export type SimDocument = {
  id: string;
  matterId: string;
  /** Parent folder id, or null when it sits at the root of Documents. */
  parentId: string | null;
  name: string;
  kind: SimDocumentKind;
  from: string;
  to: string;
  dateModified: string;
  sizeLabel: string;
  staffInitials: string;
};

export type SimTimeEntry = {
  id: string;
  matterId: string;
  date: string;
  staff: string;
  activityCode: string;
  subject: string;
  /** "Fixed" fee entries have no hours. */
  billingMode: "Fixed" | "Hrs" | "Units";
  hours: number | null;
  rate: number;
  amountExGst: number;
  gst: number;
  billable: boolean;
  billedInvoice: string | null;
  createdBySim?: boolean;
};

export type SimDisbursement = {
  id: string;
  matterId: string;
  date: string;
  staff: string;
  activityCode: string;
  subject: string;
  quantity: number;
  price: number;
  amountExGst: number;
  gst: number;
  gstInclusive: boolean;
  billable: boolean;
  billedInvoice: string | null;
  createdBySim?: boolean;
};

export type ActivityKind =
  | "Document"
  | "Email"
  | "Memo"
  | "Matter Administration"
  | "Task"
  | "Event"
  | "Matter Opened";

export type SimActivity = {
  id: string;
  matterId: string | null;
  kind: ActivityKind;
  time: string;
  description: string;
  hours: number;
  hasTimeEntry: boolean;
};

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

export type LeadStatus = "Open" | "Converted" | "Closed";

/**
 * A Lead is a prospect who hasn't retained the firm yet. It behaves like a
 * matter (parties, events, documents) but has a "Lead Details" heading, a
 * "Lead Type" instead of "Matter Type", no reference number by default, and a
 * Convert to Matter bar across the top.
 */
export type SimLead = {
  id: string;
  /** Leads have no reference number unless the firm enables it in settings. */
  number: string | null;
  leadType: MatterType;
  state: AuState;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  otherPartyName: string;
  propertyAddress: string;
  personResponsible: string;
  referralType: string;
  referrer: string;
  /** Financial details captured at enquiry. */
  estimatedFee: number | null;
  notes: string;
  status: LeadStatus;
  createdAt: string;
  convertedMatterId: string | null;
  createdBySim?: boolean;
};

/* ------------------------------------------------------------------ */
/* Workflows                                                           */
/* ------------------------------------------------------------------ */

/**
 * How a workflow task's due date is derived. Smokeball lets you set a due date
 * a number of days before/after/on a critical date, or on completion of
 * another task.
 */
export type WorkflowDueRule =
  | { kind: "days-after-open"; days: number }
  | { kind: "days-before-settlement"; days: number }
  | { kind: "on-settlement" }
  | { kind: "no-due-date" };

export type WorkflowAssignee = "Person Responsible" | "Person Assisting";

export type SimWorkflowTask = {
  id: string;
  name: string;
  priority: SimTask["priority"];
  assign: WorkflowAssignee;
  category: TaskCategory;
  details: string;
  hours: number | null;
  dueRule: WorkflowDueRule;
  /** Form or precedent letter linked to the task from the Precedent Library. */
  linkedPrecedent: string | null;
};

export type SimWorkflow = {
  id: string;
  name: string;
  matterTypes: MatterType[];
  alwaysApplyToNew: boolean;
  tasks: SimWorkflowTask[];
};

export type SimPhoneMessage = {
  id: string;
  matterId: string | null;
  caller: string;
  callerPhone: string;
  summary: string;
  takenBy: string;
  forStaff: string;
  takenAt: string;
  createdBySim?: boolean;
};

export type SimContact = {
  id: string;
  name: string;
  type: "person" | "organisation";
  organisation: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  riskAssessment: "Complete" | "Incomplete";
  createdBySim?: boolean;
};

export type SimMessage = {
  id: string;
  /** Conversation partner (internal staff member). */
  withStaff: string;
  matterId: string | null;
  from: string;
  body: string;
  sentAt: string;
  createdBySim?: boolean;
};

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export type HomeMenu = "file" | "triconvey" | "messages" | "time" | "support";

export type HomeRail =
  | "dashboard"
  | "matters"
  | "contacts"
  | "calendar"
  | "tasks"
  | "activity"
  | "reports"
  | "aml"
  | "search";

export type MatterTab =
  | "file"
  | "matter"
  | "emails"
  | "memos"
  | "events"
  | "tasks"
  | "trisearch"
  | "messages"
  | "activity"
  | "time";

export type SimScreen = "home" | "matter" | "create-matter" | "lead" | "create-lead" | "drills";

export type SimNav = {
  screen: SimScreen;
  homeMenu: HomeMenu;
  rail: HomeRail;
  /** Which folder of the matter list tree is selected. */
  matterFolder: MatterType | "All";
  matterId: string | null;
  matterTab: MatterTab;
  leadId: string | null;
  /** Sub-tab inside the firm-wide Time & Disbursements menu. */
  timeSubTab: "time" | "disbursements";
  /** Last term typed into Quick Search, shown on the Search pane. */
  searchQuery: string;
};

/* ------------------------------------------------------------------ */
/* Action log — what the guided-task checker reads                     */
/* ------------------------------------------------------------------ */

export type SimLogType =
  | "nav.rail"
  | "nav.home-menu"
  | "nav.matter.open"
  | "nav.matter.tab"
  | "nav.create-matter"
  | "memo.add"
  | "task.add"
  | "task.complete"
  | "event.add"
  | "time.add"
  | "disbursement.add"
  | "matter.create"
  | "matter.stage"
  | "matter.next-step"
  | "matter.update"
  | "message.send"
  | "lead.create"
  | "lead.open"
  | "lead.convert"
  | "workflow.apply"
  | "contact.add"
  | "email.send"
  | "phone-message.add"
  | "document.add"
  | "search";

export type SimLogEntry = {
  id: string;
  type: SimLogType;
  at: number;
  matterId: string | null;
  detail: Record<string, string | number | boolean | null>;
};

export type SimState = {
  /** Fixed "today" so seeded dates and the UI never drift apart. */
  today: string;
  user: { name: string; initials: string; firm: string };
  matters: SimMatter[];
  contacts: SimContact[];
  emails: SimEmail[];
  memos: SimMemo[];
  tasks: SimTask[];
  events: SimEvent[];
  documents: SimDocument[];
  timeEntries: SimTimeEntry[];
  disbursements: SimDisbursement[];
  activities: SimActivity[];
  messages: SimMessage[];
  phoneMessages: SimPhoneMessage[];
  leads: SimLead[];
  workflows: SimWorkflow[];
  nav: SimNav;
  log: SimLogEntry[];
};
