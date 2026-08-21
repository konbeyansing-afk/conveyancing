"use client";

/** Client-side state for the Actionstep simulator. Nothing here is persisted. */

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { AS_TODAY, AS_USER, createAsSeedState } from "./seed";
import {
  canLeaveStep,
  stepBlockers,
  type AsLogEntry,
  type AsLogType,
  type AsMatter,
  type AsState,
  type AsTab,
  type MatterType,
  type ParticipantType,
} from "./types";

export type NewActionDraft = {
  name: string;
  matterType: MatterType | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  assignedTo: string;
};

export type AsAction =
  | { type: "OPEN_MATTER"; matterId: string }
  | { type: "CLOSE_MATTER" }
  | { type: "SET_TAB"; tab: AsTab }
  | { type: "OPEN_CREATE_MATTER" }
  | { type: "CREATE_MATTER"; draft: NewActionDraft }
  | {
      type: "ADD_PARTICIPANT";
      matterId: string;
      name: string;
      participantType: ParticipantType;
      email: string;
      phone: string;
    }
  | { type: "SET_DATA_FIELD"; matterId: string; key: string; label: string; value: string }
  | { type: "CHANGE_STEP"; matterId: string; stepId: string }
  | { type: "ADD_FILE_NOTE"; matterId: string; text: string }
  | { type: "TOGGLE_TASK"; taskId: string }
  | {
      type: "ADD_TIME_ENTRY";
      matterId: string;
      description: string;
      hours: number;
      rate: number;
      billable: boolean;
    }
  | { type: "RESET" };

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-sim-${counter}`;
}

function logEntry(
  type: AsLogType,
  matterId: string | null,
  detail: AsLogEntry["detail"] = {},
): AsLogEntry {
  counter += 1;
  return { id: `aslog-${counter}`, type, at: counter, matterId, detail };
}

function withLog(state: AsState, entry: AsLogEntry): AsState {
  return { ...state, log: [...state.log, entry] };
}

function updateMatter(
  state: AsState,
  matterId: string,
  fn: (m: AsMatter) => AsMatter,
): AsState {
  return { ...state, matters: state.matters.map((m) => (m.id === matterId ? fn(m) : m)) };
}

export function formatAuDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatMoney(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export function asReducer(state: AsState, action: AsAction): AsState {
  switch (action.type) {
    case "OPEN_MATTER":
      return withLog(
        { ...state, nav: { screen: "matter", matterId: action.matterId, tab: "home" } },
        logEntry("nav.matter.open", action.matterId, {}),
      );

    case "CLOSE_MATTER":
      return { ...state, nav: { screen: "dashboard", matterId: null, tab: "home" } };

    case "SET_TAB":
      return withLog(
        { ...state, nav: { ...state.nav, tab: action.tab } },
        logEntry("nav.tab", state.nav.matterId, { tab: action.tab }),
      );

    case "OPEN_CREATE_MATTER":
      return { ...state, nav: { ...state.nav, screen: "create-matter" } };

    case "CREATE_MATTER": {
      const d = action.draft;
      const matterType = d.matterType ?? "Conveyancing — Purchase";
      const workflow = state.workflows.find((w) => w.matterType === matterType);
      const firstStep = workflow?.steps.slice().sort((a, b) => a.order - b.order)[0];
      if (!firstStep) return state;
      const highest = state.matters.reduce((max, m) => Math.max(max, m.actionId), 0);
      const matter: AsMatter = {
        id: nextId("am"),
        actionId: highest + 1,
        name: d.name,
        matterType,
        status: "Active",
        // A new matter always starts at the first step of its workflow.
        currentStepId: firstStep.id,
        stepHistory: [
          { id: nextId("sh"), stepId: firstStep.id, enteredAt: AS_TODAY, exitedAt: null },
        ],
        participants: d.clientName.trim()
          ? [
              {
                id: nextId("ap"),
                name: d.clientName.trim(),
                participantType: "Client",
                email: d.clientEmail,
                phone: d.clientPhone,
                createdBySim: true,
              },
            ]
          : [],
        dataValues: {},
        openedAt: AS_TODAY,
        assignedTo: d.assignedTo || AS_USER.name,
        createdBySim: true,
      };
      // Entering a step raises that step's tasks automatically.
      const stepTasks = firstStep.tasks.map((name) => ({
        id: nextId("at"),
        matterId: matter.id,
        name,
        assignedTo: matter.assignedTo,
        dueOn: null,
        completedOn: null,
        fromStepId: firstStep.id,
        createdBySim: true,
      }));
      return withLog(
        {
          ...state,
          matters: [matter, ...state.matters],
          tasks: [...state.tasks, ...stepTasks],
          nav: { screen: "matter", matterId: matter.id, tab: "home" },
        },
        logEntry("matter.create", matter.id, {
          name: matter.name,
          matterType: matter.matterType,
          actionId: matter.actionId,
        }),
      );
    }

    case "ADD_PARTICIPANT":
      return withLog(
        updateMatter(state, action.matterId, (m) => ({
          ...m,
          participants: [
            ...m.participants,
            {
              id: nextId("ap"),
              name: action.name,
              participantType: action.participantType,
              email: action.email,
              phone: action.phone,
              createdBySim: true,
            },
          ],
        })),
        logEntry("participant.add", action.matterId, {
          name: action.name,
          participantType: action.participantType,
        }),
      );

    case "SET_DATA_FIELD":
      return withLog(
        updateMatter(state, action.matterId, (m) => ({
          ...m,
          dataValues: { ...m.dataValues, [action.key]: action.value },
        })),
        logEntry("datafield.set", action.matterId, {
          key: action.key,
          label: action.label,
          value: action.value,
        }),
      );

    case "CHANGE_STEP": {
      const matter = state.matters.find((m) => m.id === action.matterId);
      if (!matter) return state;
      const workflow = state.workflows.find((w) => w.matterType === matter.matterType);
      const from = workflow?.steps.find((s) => s.id === matter.currentStepId);
      const to = workflow?.steps.find((s) => s.id === action.stepId);
      if (!to) return state;

      // Actionstep enforces the process: the step you are leaving must have its
      // required participants and data fields populated first.
      if (!canLeaveStep(matter, from)) {
        const b = stepBlockers(matter, from);
        return withLog(
          state,
          logEntry("step.blocked", action.matterId, {
            from: from?.name ?? null,
            to: to.name,
            missingParticipants: b.missingParticipantTypes.join(", "),
            missingFields: b.missingFields.map((f) => f.label).join(", "),
          }),
        );
      }

      const stepTasks = to.tasks.map((name) => ({
        id: nextId("at"),
        matterId: matter.id,
        name,
        assignedTo: matter.assignedTo,
        dueOn: null,
        completedOn: null,
        fromStepId: to.id,
        createdBySim: true,
      }));

      return withLog(
        {
          ...updateMatter(state, action.matterId, (m) => ({
            ...m,
            currentStepId: to.id,
            stepHistory: [
              ...m.stepHistory.map((h) =>
                h.exitedAt === null ? { ...h, exitedAt: AS_TODAY } : h,
              ),
              { id: nextId("sh"), stepId: to.id, enteredAt: AS_TODAY, exitedAt: null },
            ],
          })),
          tasks: [...state.tasks, ...stepTasks],
        },
        logEntry("step.change", action.matterId, {
          from: from?.name ?? null,
          to: to.name,
          tasksRaised: stepTasks.length,
        }),
      );
    }

    case "ADD_FILE_NOTE":
      return withLog(
        {
          ...state,
          fileNotes: [
            {
              id: nextId("fn"),
              matterId: action.matterId,
              text: action.text,
              author: state.user.name,
              createdAt: AS_TODAY,
              createdBySim: true,
            },
            ...state.fileNotes,
          ],
        },
        logEntry("filenote.add", action.matterId, { text: action.text }),
      );

    case "TOGGLE_TASK": {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task) return state;
      const completing = task.completedOn === null;
      return withLog(
        {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === action.taskId ? { ...t, completedOn: completing ? AS_TODAY : null } : t,
          ),
        },
        logEntry("task.complete", task.matterId, {
          name: task.name,
          completed: completing,
        }),
      );
    }

    case "ADD_TIME_ENTRY":
      return withLog(
        {
          ...state,
          timeEntries: [
            {
              id: nextId("ate"),
              matterId: action.matterId,
              date: AS_TODAY,
              staff: state.user.name,
              description: action.description,
              hours: action.hours,
              rate: action.rate,
              billable: action.billable,
              createdBySim: true,
            },
            ...state.timeEntries,
          ],
        },
        logEntry("time.add", action.matterId, {
          description: action.description,
          hours: action.hours,
          billable: action.billable,
        }),
      );

    case "RESET":
      return createAsSeedState();

    default:
      return state;
  }
}

type AsContextValue = {
  state: AsState;
  dispatch: Dispatch<AsAction>;
  matter: AsMatter | null;
};

const AsContext = createContext<AsContextValue | null>(null);

export function ActionstepProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(asReducer, undefined, createAsSeedState);
  const matter = useMemo(
    () => state.matters.find((m) => m.id === state.nav.matterId) ?? null,
    [state.matters, state.nav.matterId],
  );
  const value = useMemo(() => ({ state, dispatch, matter }), [state, dispatch, matter]);
  return <AsContext.Provider value={value}>{children}</AsContext.Provider>;
}

export function useActionstep(): AsContextValue {
  const ctx = useContext(AsContext);
  if (!ctx) throw new Error("useActionstep must be used inside <ActionstepProvider>");
  return ctx;
}
