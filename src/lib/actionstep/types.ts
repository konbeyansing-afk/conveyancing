/**
 * Data model for the Actionstep simulator.
 *
 * Actionstep is workflow-step-centric, which is what makes it different from
 * the other systems here. A matter (internally an "action", which is where the
 * product's name comes from) always sits AT a workflow step. Each step declares
 * the participant types and data fields it needs, and you cannot move the
 * matter forward until they are populated — the system enforces the firm's
 * process rather than just recording it.
 *
 * All data here is synthetic training data.
 */

/** Actionstep classifies everyone on a matter by participant type. */
export type ParticipantType =
  | "Client"
  | "Other Side"
  | "Other Side Lawyer"
  | "Real Estate Agent"
  | "Incoming Lender"
  | "Outgoing Lender"
  | "Referrer";

export const PARTICIPANT_TYPES: ParticipantType[] = [
  "Client",
  "Other Side",
  "Other Side Lawyer",
  "Real Estate Agent",
  "Incoming Lender",
  "Outgoing Lender",
  "Referrer",
];

export type AsParticipant = {
  id: string;
  name: string;
  participantType: ParticipantType;
  email: string;
  phone: string;
  createdBySim?: boolean;
};

/** Step data fields are prompted when a matter reaches the step. */
export type DataFieldType = "text" | "date" | "money" | "choice";

export type StepDataField = {
  key: string;
  label: string;
  type: DataFieldType;
  choices?: string[];
  /** A required field blocks the step change until it has a value. */
  required: boolean;
};

export type WorkflowStep = {
  id: string;
  name: string;
  order: number;
  description: string;
  /** Participant types the step insists are on the matter before moving on. */
  requiredParticipantTypes: ParticipantType[];
  dataFields: StepDataField[];
  /** Tasks Actionstep raises automatically on entering the step. */
  tasks: string[];
  /** Documents the step expects to be produced. */
  documents: string[];
};

export type MatterType = "Conveyancing — Purchase" | "Conveyancing — Sale";

export const MATTER_TYPES: MatterType[] = ["Conveyancing — Purchase", "Conveyancing — Sale"];

export type AsWorkflow = {
  matterType: MatterType;
  steps: WorkflowStep[];
};

/** One entry per time the matter occupied a step. */
export type StepHistoryEntry = {
  id: string;
  stepId: string;
  enteredAt: string;
  exitedAt: string | null;
};

export type AsFileNote = {
  id: string;
  matterId: string;
  text: string;
  author: string;
  createdAt: string;
  createdBySim?: boolean;
};

export type AsTask = {
  id: string;
  matterId: string;
  name: string;
  assignedTo: string;
  dueOn: string | null;
  completedOn: string | null;
  /** Tasks raised by entering a workflow step are marked so. */
  fromStepId: string | null;
  createdBySim?: boolean;
};

export type AsTimeEntry = {
  id: string;
  matterId: string;
  date: string;
  staff: string;
  description: string;
  hours: number;
  rate: number;
  billable: boolean;
  createdBySim?: boolean;
};

export type AsMatter = {
  id: string;
  /** Actionstep's Action ID — the number staff quote to each other. */
  actionId: number;
  /** Action Name — the matter's descriptive name. */
  name: string;
  matterType: MatterType;
  status: "Active" | "On Hold" | "Closed";
  currentStepId: string;
  stepHistory: StepHistoryEntry[];
  participants: AsParticipant[];
  /** Values captured against step data fields, keyed by field key. */
  dataValues: Record<string, string>;
  openedAt: string;
  assignedTo: string;
  createdBySim?: boolean;
};

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export type AsScreen = "dashboard" | "matter" | "create-matter";

export type AsTab = "home" | "parties" | "steps" | "filenotes" | "tasks" | "time";

export type AsNav = {
  screen: AsScreen;
  matterId: string | null;
  tab: AsTab;
};

/* ------------------------------------------------------------------ */
/* Action log                                                          */
/* ------------------------------------------------------------------ */

export type AsLogType =
  | "nav.matter.open"
  | "nav.tab"
  | "matter.create"
  | "participant.add"
  | "datafield.set"
  | "step.change"
  | "step.blocked"
  | "filenote.add"
  | "task.complete"
  | "time.add";

export type AsLogEntry = {
  id: string;
  type: AsLogType;
  at: number;
  matterId: string | null;
  detail: Record<string, string | number | boolean | null>;
};

export type AsState = {
  today: string;
  user: { name: string; firm: string };
  workflows: AsWorkflow[];
  matters: AsMatter[];
  fileNotes: AsFileNote[];
  tasks: AsTask[];
  timeEntries: AsTimeEntry[];
  nav: AsNav;
  log: AsLogEntry[];
};

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function workflowFor(state: AsState, matter: AsMatter): AsWorkflow | undefined {
  return state.workflows.find((w) => w.matterType === matter.matterType);
}

export function stepsFor(state: AsState, matter: AsMatter): WorkflowStep[] {
  return workflowFor(state, matter)?.steps.slice().sort((a, b) => a.order - b.order) ?? [];
}

export function currentStep(state: AsState, matter: AsMatter): WorkflowStep | undefined {
  return stepsFor(state, matter).find((s) => s.id === matter.currentStepId);
}

/** What a step still needs before the matter can leave it. */
export type StepBlocker = {
  missingParticipantTypes: ParticipantType[];
  missingFields: StepDataField[];
};

export function stepBlockers(
  matter: AsMatter,
  step: WorkflowStep | undefined,
): StepBlocker {
  if (!step) return { missingParticipantTypes: [], missingFields: [] };
  const presentTypes = new Set(matter.participants.map((p) => p.participantType));
  return {
    missingParticipantTypes: step.requiredParticipantTypes.filter((t) => !presentTypes.has(t)),
    missingFields: step.dataFields.filter(
      (f) => f.required && !(matter.dataValues[f.key] ?? "").trim(),
    ),
  };
}

export function canLeaveStep(matter: AsMatter, step: WorkflowStep | undefined): boolean {
  const b = stepBlockers(matter, step);
  return b.missingParticipantTypes.length === 0 && b.missingFields.length === 0;
}

/** Whole days a matter has spent at a step, for the Steps tab. */
export function daysInStep(entry: StepHistoryEntry, today: string): number {
  const start = Date.parse(entry.enteredAt);
  const end = Date.parse(entry.exitedAt ?? today);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}
