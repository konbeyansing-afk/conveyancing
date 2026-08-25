"use client";

/** Client-side state for the PEXA workspace simulator. Nothing here is persisted. */

import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
} from "react";
import { usePersistentReducer } from "@/lib/training/persist";
import {
  createPexaSeedState,
  PEXA_FEE_NSW_FINANCIAL,
  PEXA_TODAY,
  PEXA_USER,
} from "./seed";
import type {
  FundsDirection,
  PexaDocument,
  PexaDocumentType,
  PexaJurisdiction,
  PexaLogEntry,
  PexaLogType,
  PexaParticipant,
  PexaRole,
  PexaState,
  PexaTab,
  PexaWorkspace,
} from "./types";

export type NewWorkspaceDraft = {
  jurisdiction: PexaJurisdiction;
  titleReference: string;
  propertyAddress: string;
  matterNumber: string;
  ourRole: PexaRole | null;
  hasFinancialSettlement: boolean;
};

export type PexaAction =
  | { type: "OPEN_WORKSPACE"; workspaceId: string }
  | { type: "CLOSE_WORKSPACE" }
  | { type: "SET_TAB"; tab: PexaTab }
  | { type: "OPEN_CREATE_WORKSPACE" }
  | { type: "OPEN_REFERENCE" }
  | { type: "OPEN_DRILLS" }
  | { type: "CREATE_WORKSPACE"; draft: NewWorkspaceDraft }
  | {
      type: "INVITE_PARTICIPANT";
      workspaceId: string;
      subscriberName: string;
      role: PexaRole;
    }
  | { type: "CREATE_DOCUMENT"; workspaceId: string; documentType: PexaDocumentType }
  | { type: "SIGN_DOCUMENT"; workspaceId: string; documentId: string }
  | {
      type: "ADD_FUNDS_LINE";
      workspaceId: string;
      direction: FundsDirection;
      category: string;
      description: string;
      amount: number;
    }
  | { type: "REMOVE_FUNDS_LINE"; workspaceId: string; lineId: string }
  | { type: "PROPOSE_SETTLEMENT"; workspaceId: string; date: string; time: string }
  | { type: "ACCEPT_SETTLEMENT"; workspaceId: string }
  | { type: "SETTLE"; workspaceId: string }
  | { type: "RESET" };

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-sim-${counter}`;
}

function logEntry(
  type: PexaLogType,
  workspaceId: string | null,
  detail: PexaLogEntry["detail"] = {},
): PexaLogEntry {
  counter += 1;
  return { id: `plog-${counter}`, type, at: counter, workspaceId, detail };
}

function withLog(state: PexaState, entry: PexaLogEntry): PexaState {
  return { ...state, log: [...state.log, entry] };
}

/** Applies a change to one workspace, leaving the rest untouched. */
function updateWorkspace(
  state: PexaState,
  workspaceId: string,
  fn: (ws: PexaWorkspace) => PexaWorkspace,
): PexaState {
  return {
    ...state,
    workspaces: state.workspaces.map((w) => (w.id === workspaceId ? fn(w) : w)),
  };
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

export const STORAGE_KEY = "conveyancing-academy:sim:pexa";

export function pexaReducer(state: PexaState, action: PexaAction): PexaState {
  switch (action.type) {
    case "OPEN_WORKSPACE":
      return withLog(
        {
          ...state,
          nav: { screen: "workspace", workspaceId: action.workspaceId, tab: "summary" },
        },
        logEntry("nav.workspace.open", action.workspaceId, {}),
      );

    case "CLOSE_WORKSPACE":
      return { ...state, nav: { screen: "dashboard", workspaceId: null, tab: "summary" } };

    case "SET_TAB":
      return withLog(
        { ...state, nav: { ...state.nav, tab: action.tab } },
        logEntry("nav.tab", state.nav.workspaceId, { tab: action.tab }),
      );

    case "OPEN_CREATE_WORKSPACE":
      return { ...state, nav: { ...state.nav, screen: "create-workspace" } };

    case "OPEN_REFERENCE":
      return { ...state, nav: { ...state.nav, screen: "reference" } };

    case "OPEN_DRILLS":
      return { ...state, nav: { ...state.nav, screen: "drills" } };

    case "CREATE_WORKSPACE": {
      const d = action.draft;
      const highest = state.workspaces.reduce(
        (max, w) => Math.max(max, Number(w.workspaceNumber.replace("PX-", ""))),
        0,
      );
      const ws: PexaWorkspace = {
        id: nextId("ws"),
        workspaceNumber: `PX-${highest + 1}`,
        jurisdiction: d.jurisdiction,
        titleReference: d.titleReference,
        propertyAddress: d.propertyAddress,
        matterNumber: d.matterNumber,
        ourRole: d.ourRole ?? "Incoming Proprietor",
        settlementDate: null,
        settlementTime: null,
        proposedBy: null,
        acceptedBy: [],
        status: "In Preparation",
        hasFinancialSettlement: d.hasFinancialSettlement,
        participants: [
          {
            id: nextId("p"),
            subscriberName: PEXA_USER.subscriber,
            role: d.ourRole ?? "Incoming Proprietor",
            accepted: true,
            isSelf: true,
            invitedAt: null,
          },
        ],
        documents: [],
        // PEXA pre-populates its own fee on every financial settlement.
        funds: d.hasFinancialSettlement
          ? [
              {
                id: nextId("f"),
                direction: "Destination",
                category: "PEXA fee",
                description: "PEXA transaction fee",
                amount: PEXA_FEE_NSW_FINANCIAL,
                locked: true,
              },
            ]
          : [],
        createdBySim: true,
      };
      return withLog(
        {
          ...state,
          workspaces: [ws, ...state.workspaces],
          nav: { screen: "workspace", workspaceId: ws.id, tab: "summary" },
        },
        logEntry("workspace.create", ws.id, {
          jurisdiction: ws.jurisdiction,
          titleReference: ws.titleReference,
          role: ws.ourRole,
          matterNumber: ws.matterNumber,
        }),
      );
    }

    case "INVITE_PARTICIPANT": {
      const participant: PexaParticipant = {
        id: nextId("p"),
        subscriberName: action.subscriberName,
        role: action.role,
        // Invitations sit unaccepted until the other subscriber joins.
        accepted: false,
        isSelf: false,
        invitedAt: PEXA_TODAY,
        createdBySim: true,
      };
      const next = updateWorkspace(state, action.workspaceId, (ws) => ({
        ...ws,
        participants: [...ws.participants, participant],
      }));
      return withLog(
        {
          ...next,
          notifications: [
            {
              id: nextId("n"),
              workspaceId: action.workspaceId,
              message: `Invitation sent to ${action.subscriberName} as ${action.role}.`,
              at: `${PEXA_TODAY} 2:00 PM`,
              unread: true,
            },
            ...next.notifications,
          ],
        },
        logEntry("participant.invite", action.workspaceId, {
          subscriberName: action.subscriberName,
          role: action.role,
        }),
      );
    }

    case "CREATE_DOCUMENT": {
      const ws = state.workspaces.find((w) => w.id === action.workspaceId);
      if (!ws) return state;
      const doc: PexaDocument = {
        id: nextId("d"),
        type: action.documentType,
        status: "Prepared",
        responsibleRole: ws.ourRole,
        signedBy: null,
        signedAt: null,
        createdBySim: true,
      };
      return withLog(
        updateWorkspace(state, action.workspaceId, (w) => ({
          ...w,
          documents: [...w.documents, doc],
        })),
        logEntry("document.create", action.workspaceId, { documentType: action.documentType }),
      );
    }

    case "SIGN_DOCUMENT": {
      const ws = state.workspaces.find((w) => w.id === action.workspaceId);
      const doc = ws?.documents.find((d) => d.id === action.documentId);
      if (!ws || !doc) return state;
      return withLog(
        updateWorkspace(state, action.workspaceId, (w) => ({
          ...w,
          documents: w.documents.map((d) =>
            d.id === action.documentId
              ? {
                  ...d,
                  status: "Signed" as const,
                  signedBy: PEXA_USER.subscriber,
                  signedAt: PEXA_TODAY,
                }
              : d,
          ),
        })),
        logEntry("document.sign", action.workspaceId, { documentType: doc.type }),
      );
    }

    case "ADD_FUNDS_LINE":
      return withLog(
        updateWorkspace(state, action.workspaceId, (w) => ({
          ...w,
          funds: [
            ...w.funds,
            {
              id: nextId("f"),
              direction: action.direction,
              category: action.category,
              description: action.description,
              amount: action.amount,
              locked: false,
              createdBySim: true,
            },
          ],
        })),
        logEntry("funds.add", action.workspaceId, {
          direction: action.direction,
          category: action.category,
          amount: action.amount,
        }),
      );

    case "REMOVE_FUNDS_LINE":
      return withLog(
        updateWorkspace(state, action.workspaceId, (w) => ({
          ...w,
          funds: w.funds.filter((f) => f.id !== action.lineId || f.locked),
        })),
        logEntry("funds.remove", action.workspaceId, { lineId: action.lineId }),
      );

    case "PROPOSE_SETTLEMENT": {
      const ws = state.workspaces.find((w) => w.id === action.workspaceId);
      if (!ws) return state;
      const self = ws.participants.find((p) => p.isSelf);
      return withLog(
        updateWorkspace(state, action.workspaceId, (w) => ({
          ...w,
          settlementDate: action.date,
          settlementTime: action.time,
          proposedBy: PEXA_USER.subscriber,
          // Proposing resets everyone else's acceptance — they must re-agree.
          acceptedBy: self ? [self.id] : [],
          status: "Ready to Book",
        })),
        logEntry("settlement.propose", action.workspaceId, {
          date: action.date,
          time: action.time,
        }),
      );
    }

    case "ACCEPT_SETTLEMENT": {
      const ws = state.workspaces.find((w) => w.id === action.workspaceId);
      if (!ws) return state;
      const self = ws.participants.find((p) => p.isSelf);
      if (!self) return state;
      return withLog(
        updateWorkspace(state, action.workspaceId, (w) => ({
          ...w,
          acceptedBy: w.acceptedBy.includes(self.id) ? w.acceptedBy : [...w.acceptedBy, self.id],
        })),
        logEntry("settlement.accept", action.workspaceId, {
          date: ws.settlementDate,
          time: ws.settlementTime,
        }),
      );
    }

    case "SETTLE":
      return withLog(
        updateWorkspace(state, action.workspaceId, (w) => ({ ...w, status: "Settled" })),
        logEntry("settlement.settle", action.workspaceId, {}),
      );

    case "RESET":
      return createPexaSeedState();

    default:
      return state;
  }
}

type PexaContextValue = {
  state: PexaState;
  dispatch: Dispatch<PexaAction>;
  workspace: PexaWorkspace | null;
};

const PexaContext = createContext<PexaContextValue | null>(null);

export function PexaProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = usePersistentReducer(STORAGE_KEY, pexaReducer, createPexaSeedState);
  const workspace = useMemo(
    () => state.workspaces.find((w) => w.id === state.nav.workspaceId) ?? null,
    [state.workspaces, state.nav.workspaceId],
  );
  const value = useMemo(() => ({ state, dispatch, workspace }), [state, dispatch, workspace]);
  return <PexaContext.Provider value={value}>{children}</PexaContext.Provider>;
}

export function usePexa(): PexaContextValue {
  const ctx = useContext(PexaContext);
  if (!ctx) throw new Error("usePexa must be used inside <PexaProvider>");
  return ctx;
}
