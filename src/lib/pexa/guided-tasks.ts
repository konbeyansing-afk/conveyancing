/**
 * Guided training scenarios for the PEXA simulator.
 *
 * Same shape as the practice-management scenarios: action steps checked
 * against the workspace's action log and derived state, plus comprehension
 * questions for the judgement a click-through can't teach.
 */

import type { GuidedTask } from "@/lib/training/runner";
import { isFundsBalanced, isReadyReady, lodgementStatus } from "./types";
import type { PexaLogEntry, PexaState } from "./types";

export type PexaGuidedTask = GuidedTask<PexaState>;

function logs(state: PexaState, type: PexaLogEntry["type"]): PexaLogEntry[] {
  return state.log.filter((l) => l.type === type);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function workspace(state: PexaState, id: string) {
  return state.workspaces.find((w) => w.id === id);
}

/** The Beltran purchase workspace — early, lots left to do. */
const BELTRAN_WS = "ws-1";
/** The Raghunathan sale — booked, but the schedule doesn't balance. */
const RAGHUNATHAN_WS = "ws-2";

export const PEXA_GUIDED_TASKS: PexaGuidedTask[] = [
  {
    id: "px-read-status",
    title: "Read a workspace's readiness",
    summary: "Work out what is actually holding a settlement up from the status bars.",
    difficulty: "Beginner",
    minutes: 4,
    brief:
      "Jennie asks whether the Kestrel Parade sale is going to settle on 27 August. Open the workspace and work out what is still outstanding before you answer her.",
    skills: ["Workspace Summary", "Lodgement and Financial status", "Ready/Ready"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Kestrel Parade workspace (PX-4471088).",
        hint: "It's in the workspace list on the dashboard.",
        check: (s) => logs(s, "nav.workspace.open").some((l) => l.workspaceId === RAGHUNATHAN_WS),
      },
      {
        kind: "answer",
        instruction: "Tell Jennie what is holding it up.",
        hint: "Compare the two status bars on the Workspace Summary. One is Ready, one isn't.",
        question: "What is stopping PX-4471088 from being Ready/Ready?",
        options: [
          "The documents haven't been signed",
          "The Financial Settlement Schedule doesn't balance",
          "The other side hasn't accepted the settlement date",
          "The workspace has no settlement date",
        ],
        correct: 1,
        explanation:
          "Lodgement is Ready — both documents are signed. The Financial Settlement bar isn't, because source and destination funds don't match. A workspace needs both bars at Ready before it can settle.",
      },
    ],
  },

  {
    id: "px-balance-fss",
    title: "Balance the Financial Settlement Schedule",
    summary: "Find the shortfall in the schedule and add the line item that makes it balance.",
    difficulty: "Core",
    minutes: 8,
    brief:
      "The Kestrel Parade sale settles on 27 August and the Financial Settlement Schedule does not balance. The council rates adjustment was worked out after the vendor's figures were prepared and never made it onto the schedule. Open the schedule, read what it is short by, and add the council rates adjustment for that amount so it balances to the cent.",
    skills: ["Financial Settlement Schedule", "Source and destination funds", "Balancing"],
    steps: [
      {
        kind: "action",
        instruction: "Open PX-4471088 and go to the Financial Settlement Schedule tab.",
        hint: "The tabs run across the top of the workspace.",
        check: (s) =>
          logs(s, "nav.tab").some(
            (l) => l.workspaceId === RAGHUNATHAN_WS && l.detail.tab === "financial",
          ),
      },
      {
        kind: "action",
        instruction: "Add the destination line items needed to close the gap.",
        hint: "The banner at the top tells you exactly how much it is out by. Add a Destination line under Council rates adjustment for that amount.",
        check: (s) =>
          logs(s, "funds.add").some(
            (l) => l.workspaceId === RAGHUNATHAN_WS && l.detail.direction === "Destination",
          ),
      },
      {
        kind: "action",
        instruction: "Get the schedule to balance exactly.",
        hint: "Source and destination totals must match to the cent — the header turns green when they do.",
        check: (s) => {
          const ws = workspace(s, RAGHUNATHAN_WS);
          return ws ? isFundsBalanced(ws) : false;
        },
      },
      {
        kind: "answer",
        instruction: "Check what happens if it doesn't balance.",
        hint: "Think about what PEXA does at the settlement time, not before.",
        question: "What happens on settlement day if the schedule is still out by a few dollars?",
        options: [
          "PEXA rounds the difference and settles anyway",
          "Settlement fails, and everyone — including the other side and the banks — has to rebook",
          "The shortfall is automatically taken from the firm's trust account",
          "The land registry lodges the documents and chases the money afterwards",
        ],
        correct: 1,
        explanation:
          "An unbalanced schedule means settlement doesn't proceed. A failed settlement can put your client in breach, trigger penalty interest, and means rebooking around the other side and their lender. This is why the schedule is checked well before the day, not on it.",
      },
    ],
  },

  {
    id: "px-invite-participant",
    title: "Invite the other side into a workspace",
    summary: "Bring another subscriber in under the right role.",
    difficulty: "Core",
    minutes: 5,
    brief:
      "Your client on the Beltran purchase is borrowing from Meridian Bank. The bank needs to be in the PEXA workspace to prepare and sign the mortgage. Invite them.",
    skills: ["Participants", "Workspace roles", "Invitations"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Marlowe Street workspace (PX-4482193) and go to Participants.",
        hint: "Dashboard → PX-4482193 → Participants tab.",
        check: (s) =>
          logs(s, "nav.tab").some(
            (l) => l.workspaceId === BELTRAN_WS && l.detail.tab === "participants",
          ),
      },
      {
        kind: "action",
        instruction: "Invite Meridian Bank as the Incoming Mortgagee.",
        hint: "Pick the subscriber, set the role to Incoming Mortgagee, then send the invitation.",
        check: (s) =>
          logs(s, "participant.invite").some(
            (l) =>
              l.workspaceId === BELTRAN_WS &&
              str(l.detail.subscriberName).includes("meridian") &&
              str(l.detail.role).includes("incoming mortgagee"),
          ),
      },
      {
        kind: "answer",
        instruction: "Check you understand why the role matters.",
        hint: "Roles decide what a participant can create and sign.",
        question:
          "You invite the incoming lender as Mortgagee on Title instead of Incoming Mortgagee. What happens?",
        options: [
          "Nothing — the roles are interchangeable",
          "They can't prepare the new mortgage, because that role is for the lender being paid out, not the one lending",
          "PEXA corrects the role automatically",
          "The workspace settles but the mortgage is registered late",
        ],
        correct: 1,
        explanation:
          "Mortgagee on Title is the existing lender being discharged. Incoming Mortgagee is the new one. Get it wrong and the bank cannot prepare the document they are there to sign, which is usually discovered far too close to settlement.",
      },
    ],
  },

  {
    id: "px-prepare-transfer",
    title: "Prepare and sign the Transfer",
    summary: "Create the registry document your role is responsible for, and sign it.",
    difficulty: "Core",
    minutes: 6,
    brief:
      "The Beltran purchase needs its Transfer prepared so lodgement can move towards Ready. You act for the purchaser, so the Transfer is yours to create and sign. The client authorisation is signed and on file.",
    skills: ["Documents", "Digital signing", "Lodgement status"],
    steps: [
      {
        kind: "action",
        instruction: "Open PX-4482193 and go to the Documents tab.",
        hint: "The Transfer is already sitting there in Draft.",
        check: (s) =>
          logs(s, "nav.tab").some(
            (l) => l.workspaceId === BELTRAN_WS && l.detail.tab === "documents",
          ),
      },
      {
        kind: "action",
        instruction: "Sign the Transfer so lodgement reaches Ready.",
        hint: "Use the Sign button on the Transfer row.",
        check: (s) => {
          const ws = workspace(s, BELTRAN_WS);
          return ws ? lodgementStatus(ws) === "Ready" : false;
        },
      },
      {
        kind: "answer",
        instruction: "Check what signing actually means here.",
        hint: "Think about whose authority you are signing under.",
        question: "What lets you sign a registry document on your client's behalf in PEXA?",
        options: [
          "Your PEXA subscription — signing rights come with the account",
          "A signed Client Authorisation form, plus verification of the client's identity",
          "Verbal instructions from the client are enough",
          "The fee earner's PEXA login being used by whoever is at the desk",
        ],
        correct: 1,
        explanation:
          "You sign under a signed Client Authorisation, and only after the client's identity has been verified. Sharing a signing certificate or logging in as someone else is a serious breach — the signature is personal to the certificate holder.",
      },
    ],
  },

  {
    id: "px-settlement-date",
    title: "Propose and agree a settlement date",
    summary: "Book a settlement time and understand what re-proposing costs everyone.",
    difficulty: "Core",
    minutes: 6,
    brief:
      "The Marlowe Street settlement needs a time locked in. Contracts say 4 September. Propose 4 September at 2:00 PM in the workspace, then accept it on our side.",
    skills: ["Settlement booking", "Participant acceptance", "Ready to Book"],
    steps: [
      {
        kind: "action",
        instruction: "Open PX-4482193 and go to the Settlement tab.",
        hint: "Dashboard → PX-4482193 → Settlement.",
        check: (s) =>
          logs(s, "nav.tab").some(
            (l) => l.workspaceId === BELTRAN_WS && l.detail.tab === "settlement",
          ),
      },
      {
        kind: "action",
        instruction: "Propose 4 September 2026 at 2:00 PM.",
        hint: "Use Accept or Propose New Settlement Date and Time, then press propose.",
        check: (s) =>
          logs(s, "settlement.propose").some(
            (l) => l.workspaceId === BELTRAN_WS && str(l.detail.date).includes("2026-09-04"),
          ),
      },
      {
        kind: "action",
        instruction: "Accept the date on our side.",
        hint: "Use the Accept settlement date and time button.",
        check: (s) =>
          logs(s, "settlement.accept").some((l) => l.workspaceId === BELTRAN_WS),
      },
      {
        kind: "answer",
        instruction: "Check what re-proposing a date does.",
        hint: "Look at what happened to the acceptances when you proposed.",
        question:
          "The other side asks you to move settlement by an hour, so you propose a new time. What happens to the acceptances already given?",
        options: [
          "They carry over — only the time changed",
          "They are cleared, and every participant has to accept again",
          "Only the participant who asked for the change has to re-accept",
          "PEXA keeps the old booking as a fallback",
        ],
        correct: 1,
        explanation:
          "Proposing resets everyone's acceptance. On a matter with a discharging bank and an incoming lender that can take a day or more to re-gather, so never re-propose without telling the other participants it is coming.",
      },
    ],
  },

  {
    id: "px-create-workspace",
    title: "Create a workspace from scratch",
    summary: "Open a new PEXA workspace for a matter and take it to a settled state.",
    difficulty: "Advanced",
    minutes: 10,
    brief:
      "A new purchase has exchanged: 5/40 Ferndale Road, Epping NSW 2121, title 12/SP84421, our matter 004194. We act for the purchaser and there is a financial settlement. Create the workspace and get it moving.",
    skills: ["Workspace creation", "Roles", "Jurisdiction"],
    steps: [
      {
        kind: "action",
        instruction:
          "Create a NSW workspace for title 12/SP84421, acting as Incoming Proprietor.",
        hint: "Create Workspace on the dashboard. Set jurisdiction, title reference and your role.",
        check: (s) =>
          logs(s, "workspace.create").some(
            (l) =>
              str(l.detail.titleReference).includes("12/sp84421") &&
              str(l.detail.role).includes("incoming proprietor"),
          ),
      },
      {
        kind: "action",
        instruction: "Invite the vendor's representative into the workspace.",
        hint: "Participants tab — invite a subscriber as Proprietor on Title.",
        check: (s) =>
          logs(s, "participant.invite").some((l) =>
            str(l.detail.role).includes("proprietor on title"),
          ),
      },
      {
        kind: "action",
        instruction: "Create the Transfer document on the new workspace.",
        hint: "Documents tab → choose Transfer → Create.",
        check: (s) => logs(s, "document.create").some((l) => str(l.detail.documentType) === "transfer"),
      },
      {
        kind: "answer",
        instruction: "Check the consequence of getting the jurisdiction wrong.",
        hint: "Land registries are state-based.",
        question: "You create the workspace in VIC for a NSW property. What is the effect?",
        options: [
          "None — PEXA works out the correct registry from the address",
          "The workspace uses the wrong registry's documents and requirements, and cannot lodge against a NSW title",
          "The documents lodge but attract a small penalty fee",
          "It only matters if there is a mortgage involved",
        ],
        correct: 1,
        explanation:
          "Each state has its own land registry, its own forms and its own rules. The wrong jurisdiction means the workspace cannot lodge at all, and the work has to be redone in a new workspace.",
      },
    ],
  },

  {
    id: "px-ready-ready",
    title: "Take a workspace to Ready / Ready",
    summary: "Clear every outstanding item on a settlement and settle it.",
    difficulty: "Advanced",
    minutes: 10,
    brief:
      "The Kestrel Parade sale settles on 27 August. Everything is nearly there. Clear whatever is still outstanding so the workspace reaches Ready/Ready, then settle it.",
    skills: ["Ready/Ready", "Settlement", "End-to-end workspace"],
    steps: [
      {
        kind: "action",
        instruction: "Get PX-4471088 to Ready / Ready.",
        hint: "The Workspace Summary lists exactly what is outstanding — work down the list.",
        check: (s) => {
          const ws = workspace(s, RAGHUNATHAN_WS);
          return ws ? isReadyReady(ws) : false;
        },
      },
      {
        kind: "action",
        instruction: "Settle the workspace.",
        hint: "The Settle button appears on the Workspace Summary once it is Ready/Ready.",
        check: (s) => logs(s, "settlement.settle").some((l) => l.workspaceId === RAGHUNATHAN_WS),
      },
      {
        kind: "answer",
        instruction: "Check what settling actually did.",
        hint: "Two things happen at once at the settlement time.",
        question: "What happens at the moment of settlement in PEXA?",
        options: [
          "Funds are disbursed, and the documents are lodged with the land registry",
          "Only the money moves — lodgement is done separately by post",
          "Only the documents lodge — funds are transferred by the banks the next day",
          "Nothing automatic; the practitioners confirm by phone afterwards",
        ],
        correct: 0,
        explanation:
          "Electronic settlement does both together: funds move to the destination line items and the registry documents lodge. That simultaneity is the point — the vendor gets paid as title passes, so neither side carries the other's risk.",
      },
    ],
  },
];
