/**
 * Guided training scenarios for the Actionstep simulator.
 *
 * The theme throughout is that the workflow enforces the process: a matter
 * cannot leave a step until that step's requirements are satisfied, so the
 * skill is reading what a step needs and supplying it.
 */

import type { GuidedTask } from "@/lib/training/runner";
import { currentStep } from "./types";
import type { AsLogEntry, AsState } from "./types";

export type AsGuidedTask = GuidedTask<AsState>;

function logs(state: AsState, type: AsLogEntry["type"]): AsLogEntry[] {
  return state.log.filter((l) => l.type === type);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function matterById(state: AsState, id: string) {
  return state.matters.find((m) => m.id === id);
}

/** The Beltran purchase — stuck at Pre-Settlement with unmet requirements. */
const BELTRAN = "am-1";
/** The Raghunathan sale — healthy, used for reading step history. */
const RAGHUNATHAN = "am-2";

export const AS_GUIDED_TASKS: AsGuidedTask[] = [
  {
    id: "as-read-step",
    title: "Find out why a matter is stuck",
    summary: "Read a matter's current step and work out what the workflow is waiting for.",
    difficulty: "Beginner",
    minutes: 5,
    brief:
      "Jennie says the Beltran purchase 'won't let her move it on' and asks you to look. Open the matter and work out exactly what the step is waiting for before you reply.",
    skills: ["Workflow steps", "Step requirements", "Diagnosis"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Beltran purchase (Action 10482).",
        hint: "It's in the matter list, flagged as blocked.",
        check: (s) => logs(s, "nav.matter.open").some((l) => l.matterId === BELTRAN),
      },
      {
        kind: "action",
        instruction: "Go to the Steps tab to see the step's requirements.",
        hint: "The Steps tab lists required participant types and data fields.",
        check: (s) =>
          logs(s, "nav.tab").some((l) => l.matterId === BELTRAN && l.detail.tab === "steps"),
      },
      {
        kind: "answer",
        instruction: "Tell Jennie what is missing.",
        hint: "Look at both lists on the Steps tab — participants and data fields.",
        question: "What is stopping the Beltran matter leaving Pre-Settlement?",
        options: [
          "Nothing — the matter has already been moved on",
          "An Incoming Lender participant is missing, and the searches and adjustments fields are unanswered",
          "The settlement date has not been entered",
          "The client has not been verified",
        ],
        correct: 1,
        explanation:
          "Pre-Settlement requires Client, Other Side Lawyer and Incoming Lender participants, plus answers to 'Searches returned' and 'Adjustments prepared'. Two of those are outstanding. The workflow will refuse the step change until they are supplied.",
      },
    ],
  },

  {
    id: "as-unblock-step",
    title: "Unblock a step and move the matter on",
    summary: "Supply what the workflow is waiting for, then complete the step.",
    difficulty: "Core",
    minutes: 9,
    brief:
      "The Beltran purchase is stuck at Pre-Settlement. The client is borrowing from Meridian Bank, the searches came back clean yesterday, and Jennie has finished the adjustments. Put that on the matter and move it to Settlement.",
    skills: ["Participants", "Step data fields", "Changing steps"],
    steps: [
      {
        kind: "action",
        instruction:
          "Try to change the step first, so you can see what the workflow does when requirements are outstanding.",
        hint: "Steps tab → Change step. It will be refused, which is the point.",
        check: (s) => logs(s, "step.blocked").some((l) => l.matterId === BELTRAN),
      },
      {
        kind: "action",
        instruction: "Add Meridian Bank to the matter as an Incoming Lender.",
        hint: "Parties tab → Add a participant → participant type Incoming Lender.",
        check: (s) =>
          logs(s, "participant.add").some(
            (l) =>
              l.matterId === BELTRAN &&
              str(l.detail.name).includes("meridian") &&
              str(l.detail.participantType).includes("incoming lender"),
          ),
      },
      {
        kind: "action",
        instruction: "Answer the two required data fields on the step.",
        hint: "Steps tab — set 'Searches returned' and 'Adjustments prepared' to Yes.",
        check: (s) => {
          const m = matterById(s, BELTRAN);
          if (!m) return false;
          return (
            (m.dataValues.searchesComplete ?? "").length > 0 &&
            (m.dataValues.adjustmentsPrepared ?? "").length > 0
          );
        },
      },
      {
        kind: "action",
        instruction: "Change the step to Settlement.",
        hint: "With the requirements met, the Change step button now works.",
        check: (s) =>
          logs(s, "step.change").some(
            (l) => l.matterId === BELTRAN && str(l.detail.to).includes("settlement"),
          ),
      },
      {
        kind: "answer",
        instruction: "Check what changing the step did.",
        hint: "Look at the Tasks tab afterwards.",
        question: "What else happened when the matter moved to Settlement?",
        options: [
          "Nothing — a step change only updates the step name",
          "The step's tasks were raised automatically on the matter, and the time spent in the previous step was recorded",
          "All outstanding tasks were closed",
          "The client was notified by email",
        ],
        correct: 1,
        explanation:
          "Entering a step raises that step's tasks, and the step history records when you left the previous one. That history is how a firm sees which stage files get stuck at — so moving steps promptly matters beyond just tidiness.",
      },
    ],
  },

  {
    id: "as-file-note",
    title: "Record a file note",
    summary: "Put a conversation on the matter so the next person sees it.",
    difficulty: "Beginner",
    minutes: 4,
    brief:
      "The agent rings about the Raghunathan sale: the purchaser wants access before settlement to measure for blinds. Nothing has been agreed. Record it on the file.",
    skills: ["File notes", "File-note discipline"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Raghunathan sale and go to the File Notes tab.",
        hint: "Action 10476.",
        check: (s) =>
          logs(s, "nav.tab").some((l) => l.matterId === RAGHUNATHAN && l.detail.tab === "filenotes"),
      },
      {
        kind: "action",
        instruction: "Record a note about the access request.",
        hint: "Mention access, and that nothing has been agreed yet.",
        check: (s) =>
          logs(s, "filenote.add").some(
            (l) =>
              l.matterId === RAGHUNATHAN &&
              ["access", "blind", "measure"].some((w) => str(l.detail.text).includes(w)),
          ),
      },
      {
        kind: "answer",
        instruction: "Check what you should do next.",
        hint: "Access before settlement is a real risk question, not an admin one.",
        question: "The agent asks you to just confirm the access is fine. What do you do?",
        options: [
          "Confirm it — measuring for blinds is harmless",
          "Record the request, tell the agent it needs the vendor's instructions through the fee earner, and escalate it",
          "Refuse the request outright",
          "Tell the agent to ask the purchaser's lawyer instead",
        ],
        correct: 1,
        explanation:
          "Pre-settlement access raises insurance and risk-of-loss questions, and it is the vendor's call, not ours. A VA records the request and routes it — agreeing on the client's behalf is exactly the sort of thing that turns into a dispute.",
      },
    ],
  },

  {
    id: "as-step-history",
    title: "Read a matter's step history",
    summary: "Use the step history to see where a file has spent its time.",
    difficulty: "Core",
    minutes: 5,
    brief:
      "The principal wants to know where conveyancing files lose time. Look at the Raghunathan sale's step history and work out which step it sat in longest.",
    skills: ["Step history", "Time in step", "Reporting"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Raghunathan sale and go to the Steps tab.",
        hint: "The step history table is at the bottom of the tab.",
        check: (s) =>
          logs(s, "nav.tab").some((l) => l.matterId === RAGHUNATHAN && l.detail.tab === "steps"),
      },
      {
        kind: "answer",
        instruction: "Answer the principal's question.",
        hint: "Compare the Days in step column, not the dates themselves.",
        question: "Which step has the Raghunathan sale spent longest in?",
        options: [
          "Instructions Received",
          "Contract Preparation",
          "Exchange",
          "Pre-Settlement",
        ],
        correct: 2,
        explanation:
          "Exchange ran 26 June to 5 August — about 40 days, far longer than any other step. On a sale that usually means waiting on the purchaser, which is worth knowing when the firm looks at why files run long.",
      },
    ],
  },

  {
    id: "as-create-matter",
    title: "Open a new matter",
    summary: "Create a matter and see the workflow start it off.",
    difficulty: "Core",
    minutes: 7,
    brief:
      "A new purchase has come in for Dominic Ashcroft-Reyes at 5/40 Ferndale Road, Epping. Open the matter in Actionstep so the workflow can start driving it.",
    skills: ["Creating matters", "Matter types", "Workflow start"],
    steps: [
      {
        kind: "action",
        instruction: "Create a Conveyancing — Purchase matter for Ashcroft-Reyes.",
        hint: "New Matter on the matter list. Give it a descriptive name and pick the matter type.",
        check: (s) =>
          logs(s, "matter.create").some(
            (l) =>
              str(l.detail.name).includes("ashcroft") &&
              str(l.detail.matterType).includes("purchase"),
          ),
      },
      {
        kind: "action",
        instruction: "Check the new matter landed at the first step of the workflow.",
        hint: "Open the Steps tab on the matter you just created.",
        check: (s) => {
          const created = s.matters.find((m) => m.createdBySim);
          if (!created) return false;
          const step = currentStep(s, created);
          return step?.order === 1;
        },
      },
      {
        kind: "answer",
        instruction: "Check why the matter type matters so much here.",
        hint: "Think about what the matter type is actually selecting.",
        question: "What does choosing the matter type actually decide?",
        options: [
          "Only how the matter is labelled in reports",
          "Which workflow the matter follows — its steps, their required participants and data fields, and the tasks raised along the way",
          "Nothing functional; it is for the firm's statistics",
          "Only which staff member the matter is assigned to",
        ],
        correct: 1,
        explanation:
          "The matter type selects the whole workflow. Choose the wrong one and the matter runs a process built for a different kind of file — wrong steps, wrong required fields, wrong tasks. It is not a label, it is the process.",
      },
    ],
  },

  {
    id: "as-record-time",
    title: "Record time against a matter",
    summary: "Enter billable time in decimal hours on the right file.",
    difficulty: "Beginner",
    minutes: 4,
    brief:
      "You spent 24 minutes drafting the letter to the Beltran clients confirming the settlement booking. Record it as billable time on that matter.",
    skills: ["Time recording", "Decimal hours"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Beltran matter and go to the Time tab.",
        hint: "Action 10482 → Time.",
        check: (s) =>
          logs(s, "nav.tab").some((l) => l.matterId === BELTRAN && l.detail.tab === "time"),
      },
      {
        kind: "action",
        instruction: "Record 0.4 hours of billable time for the letter.",
        hint: "24 minutes ÷ 60 = 0.4.",
        check: (s) =>
          logs(s, "time.add").some(
            (l) =>
              l.matterId === BELTRAN &&
              typeof l.detail.hours === "number" &&
              l.detail.hours >= 0.35 &&
              l.detail.hours <= 0.45,
          ),
      },
      {
        kind: "answer",
        instruction: "Check your decimal conversion.",
        hint: "Divide minutes by 60.",
        question: "You spend 50 minutes on a matter. What do you record?",
        options: ["0.50", "0.83", "5.00", "0.50 rounded up to 1.00"],
        correct: 1,
        explanation:
          "50 ÷ 60 = 0.833…, entered as 0.83. Recording 0.50 would give away twenty minutes of chargeable work — small on one entry, significant across a week.",
      },
    ],
  },

  {
    id: "as-full-cycle",
    title: "Take a matter through two steps",
    summary: "Work a matter end to end through consecutive workflow steps.",
    difficulty: "Advanced",
    minutes: 10,
    brief:
      "The Okonkwo purchase is sitting at Contract Review. The contract came in on 16 August, the price is $1,395,000, the other side is acting through Pemberton Waye Lawyers, and contracts exchanged today with a settlement date of 16 October 2026 and a 10% deposit. Bring the matter up to date.",
    skills: ["Multi-step progression", "Participants", "Data fields"],
    steps: [
      {
        kind: "action",
        instruction: "Add the other side's lawyer to the Okonkwo matter.",
        hint: "Parties tab → participant type Other Side Lawyer.",
        check: (s) =>
          logs(s, "participant.add").some(
            (l) => l.matterId === "am-3" && str(l.detail.participantType).includes("other side lawyer"),
          ),
      },
      {
        kind: "action",
        instruction: "Complete the Contract Review data fields and move the matter to Exchange.",
        hint: "Contract received and Purchase price are both required before the step will release.",
        check: (s) =>
          logs(s, "step.change").some(
            (l) => l.matterId === "am-3" && str(l.detail.to).includes("exchange"),
          ),
      },
      {
        kind: "action",
        instruction: "Complete the Exchange step's fields and move the matter to Pre-Settlement.",
        hint: "Exchange needs exchange date, deposit paid and settlement date.",
        check: (s) =>
          logs(s, "step.change").some(
            (l) => l.matterId === "am-3" && str(l.detail.to).includes("pre-settlement"),
          ),
      },
      {
        kind: "answer",
        instruction: "Check what the matter now needs.",
        hint: "Pre-Settlement has its own required participant types.",
        question: "The matter is now at Pre-Settlement. What will it need before it can move again?",
        options: [
          "Nothing — the remaining steps have no requirements",
          "An Incoming Lender on the matter, plus answers on searches and adjustments",
          "Only the settlement date, which is already recorded",
          "A second fee earner assigned to the matter",
        ],
        correct: 1,
        explanation:
          "Every step declares its own requirements. Pre-Settlement wants the incoming lender on the file and confirmation that searches are back and adjustments are done — which is the workflow making sure nobody reaches settlement day with those open.",
      },
    ],
  },

  {
    id: "as-find-missing-matter",
    title: "Find a matter that isn't there",
    summary: "Work out why a matter you know exists doesn't show up in the list.",
    difficulty: "Beginner",
    minutes: 4,
    brief:
      "Someone asks you to check the settlement figures on the Nakamura sale — 22 Silverwater Lane, Hornsby. You go to Matters and it isn't in the list.",
    skills: ["Matters list", "Filters", "Not trusting an empty result"],
    steps: [
      {
        kind: "action",
        instruction: "Go to the Matters screen.",
        hint: "It's in the global bar at the top, always visible.",
        check: (s) => logs(s, "nav.global").some((l) => l.detail.screen === "matters"),
      },
      {
        kind: "action",
        instruction: "The list defaults to Active matters only. Clear the filter so it shows everything.",
        hint: "The filter control sits above the list, next to a badge that says a filter is active.",
        check: (s) =>
          logs(s, "matters.filter").some(
            (l) => l.detail.status === "All" || l.detail.status === "Closed",
          ),
      },
      {
        kind: "action",
        instruction: "Open the Nakamura matter now that it's visible.",
        hint: "It's a Closed matter — that's exactly why the default filter was hiding it.",
        check: (s) => logs(s, "nav.matter.open").some((l) => l.matterId === "am-4"),
      },
      {
        kind: "answer",
        instruction: "Check what actually happened.",
        hint: "Nothing about the matter itself changed between not finding it and finding it.",
        question: "Why didn't Nakamura show up the first time you looked at Matters?",
        options: [
          "The matter had been deleted",
          "You don't have permission to see closed matters",
          "A status filter was narrowing the list to Active matters, and Nakamura is Closed",
          "The matter was never actually created",
        ],
        correct: 2,
        explanation:
          "An empty or short list is almost never an empty file — it's usually a filter left switched on. Before telling anyone a matter, task or appointment doesn't exist, check whether a filter is active and clear it first.",
      },
    ],
  },
];
