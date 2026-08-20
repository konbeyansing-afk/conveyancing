/**
 * Guided training scenarios that run on top of the simulator.
 *
 * A scenario is a short piece of realistic firm context plus an ordered list
 * of steps. Two kinds of step exist:
 *
 *  - action steps carry a `check(state)` predicate evaluated against the
 *    simulator's action log, so they only pass when the trainee genuinely did
 *    the thing (created the memo, ticked the task, saved the time entry);
 *  - answer steps ask a comprehension question with one correct option, for
 *    the "do you understand why" half of the training.
 */

import type { SimLogEntry, SimState } from "./types";

export type GuidedStepBase = {
  instruction: string;
  hint: string;
};

export type GuidedActionStep = GuidedStepBase & {
  kind: "action";
  check: (state: SimState) => boolean;
};

export type GuidedAnswerStep = GuidedStepBase & {
  kind: "answer";
  question: string;
  options: string[];
  correct: number;
  /** Shown once the trainee answers, right or wrong. */
  explanation: string;
};

export type GuidedStep = GuidedActionStep | GuidedAnswerStep;

export type GuidedTask = {
  id: string;
  title: string;
  /** One-line summary for the task list. */
  summary: string;
  difficulty: "Beginner" | "Core" | "Advanced";
  minutes: number;
  /** Realistic instruction as it would arrive from a fee earner. */
  brief: string;
  skills: string[];
  steps: GuidedStep[];
};

/* ------------------------------------------------------------------ */
/* Log helpers                                                         */
/* ------------------------------------------------------------------ */

function logs(state: SimState, type: SimLogEntry["type"]): SimLogEntry[] {
  return state.log.filter((l) => l.type === type);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function mentionsAll(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.every((w) => lower.includes(w.toLowerCase()));
}

function mentionsAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

function opened(state: SimState, matterId: string): boolean {
  return logs(state, "nav.matter.open").some((l) => l.matterId === matterId);
}

function visitedTab(state: SimState, matterId: string, tab: string): boolean {
  return logs(state, "nav.matter.tab").some(
    (l) => l.matterId === matterId && l.detail.tab === tab,
  );
}

/** The Beltran purchase — the file most scenarios run on. */
const BELTRAN = "m-4182";
const RAGHUNATHAN = "m-4176";

export const GUIDED_TASKS: GuidedTask[] = [
  {
    id: "gt-find-settlement",
    title: "Find the settlement date on a file",
    summary: "Navigate the matter list, open a file, and read the key dates off Matter Details.",
    difficulty: "Beginner",
    minutes: 3,
    brief:
      "Jennie calls you from the car: \"I'm about to ring the Beltrans back — what date is settlement on their purchase, and are they the buyer or the seller?\" Find the file and answer her.",
    skills: ["Matter list navigation", "Reading Matter Details"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Matters list from the left-hand rail.",
        hint: "The left rail runs down the far-left edge of the window: Dashboard, Matters, Contacts, Calendar…",
        check: (s) => logs(s, "nav.rail").some((l) => l.detail.rail === "matters"),
      },
      {
        kind: "action",
        instruction: "Open the Beltran purchase (matter 004182).",
        hint: "Double-click the row in the matter list, or click the matter number.",
        check: (s) => opened(s, BELTRAN),
      },
      {
        kind: "answer",
        instruction: "Answer Jennie's question.",
        hint: "Look at the Conveyancing Details row in Matter Details, and at the matter's subtitle in the header.",
        question: "When does the Beltran matter settle, and which side does the firm act for?",
        options: [
          "4 September 2026 — the firm acts for the purchaser",
          "4 September 2026 — the firm acts for the vendor",
          "27 August 2026 — the firm acts for the purchaser",
          "8 August 2026 — the firm acts for the vendor",
        ],
        correct: 0,
        explanation:
          "The header reads \"004182 - Purchase - Whitlam, Trevor D. and Denise K.\" — the matter type tells you which side you act for, and the name after it is the other party. Settlement is on the Conveyancing Details row: 04/09/2026.",
      },
    ],
  },

  {
    id: "gt-file-note",
    title: "Record a file note as a memo",
    summary: "Capture a phone conversation on the file so the next person to touch it knows what happened.",
    difficulty: "Core",
    minutes: 5,
    brief:
      "The other side's assistant rings: the Whitlams will leave the shed key and the remote with the agent rather than handing them over at settlement. Nothing is in writing yet. Put it on the file so it isn't lost.",
    skills: ["Memos", "File-note discipline"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Beltran purchase (matter 004182).",
        hint: "Matters in the left rail, then the 004182 row.",
        check: (s) => opened(s, BELTRAN),
      },
      {
        kind: "action",
        instruction: "Go to the MEMOS tab on that matter.",
        hint: "The tab strip runs across the top of the matter window: FILE · MATTER · EMAILS · MEMOS · …",
        check: (s) => visitedTab(s, BELTRAN, "memos"),
      },
      {
        kind: "action",
        instruction:
          "Add a memo recording the call. The note must mention the key and that it is being left with the agent.",
        hint: "Click ADD MEMO, give it a dated title, and write what you were told in the body.",
        check: (s) =>
          logs(s, "memo.add").some(
            (l) =>
              l.matterId === BELTRAN &&
              mentionsAll(`${str(l.detail.title)} ${str(l.detail.body)}`, ["key"]) &&
              mentionsAny(`${str(l.detail.title)} ${str(l.detail.body)}`, ["agent", "agency"]),
          ),
      },
      {
        kind: "answer",
        instruction: "Confirm you know why this went on the file as a memo.",
        hint: "Think about what happens when someone else picks up this file while you are on leave.",
        question: "Why record a phone conversation as a memo rather than just remembering it?",
        options: [
          "Memos are billable and emails are not",
          "It puts the conversation on the file so anyone opening the matter later sees it, and it is evidence of what was agreed",
          "The system deletes anything that isn't written down within 24 hours",
          "Because the other side cannot see memos",
        ],
        correct: 1,
        explanation:
          "A memo is the file's memory. Verbal variations are the single most common source of settlement disputes — if it isn't on the file, it didn't happen. Also follow up in writing with the other side to confirm.",
      },
    ],
  },

  {
    id: "gt-time-entry",
    title: "Record billable time",
    summary: "Convert minutes to decimal hours and save a billable time entry against the right matter.",
    difficulty: "Core",
    minutes: 6,
    brief:
      "You have just come off an 18-minute call with the purchaser's broker at Ridgeline Finance about the Beltran loan approval. Record it as billable time on the Beltran matter, using the telephone attendance activity code.",
    skills: ["Time & Disbursements", "Decimal hours", "Activity codes"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Beltran purchase (matter 004182).",
        hint: "Matters in the left rail, then the 004182 row.",
        check: (s) => opened(s, BELTRAN),
      },
      {
        kind: "action",
        instruction: "Go to the TIME & DISBURSEMENTS tab on that matter.",
        hint: "It is the last tab before ARCHIE in the matter tab strip.",
        check: (s) => visitedTab(s, BELTRAN, "time"),
      },
      {
        kind: "action",
        instruction:
          "Add a billable time entry of 0.3 hours against activity code TELEP, describing the call.",
        hint: "18 minutes ÷ 60 = 0.3. Set Duration to 0.3 with Hrs selected, pick TELEP, then ADD.",
        check: (s) =>
          logs(s, "time.add").some(
            (l) =>
              l.matterId === BELTRAN &&
              l.detail.billable === true &&
              l.detail.activityCode === "TELEP" &&
              typeof l.detail.hours === "number" &&
              l.detail.hours >= 0.25 &&
              l.detail.hours <= 0.35,
          ),
      },
      {
        kind: "answer",
        instruction: "Check your understanding of decimal time.",
        hint: "Divide the minutes by 60.",
        question: "A 25-minute attendance is recorded as how many decimal hours (to two places)?",
        options: ["0.25", "0.42", "2.50", "0.30"],
        correct: 1,
        explanation:
          "25 ÷ 60 = 0.4166…, entered as 0.42. Writing 0.25 would under-bill the file by nearly ten minutes — a mistake that repeats across every file you touch.",
      },
    ],
  },

  {
    id: "gt-disbursement",
    title: "Record a disbursement",
    summary: "Enter an outlay the firm paid on the client's behalf, with GST handled correctly.",
    difficulty: "Core",
    minutes: 5,
    brief:
      "You ordered a council rates certificate for the Beltran purchase. The invoice is $99.00 including GST. Record it as a billable disbursement on the file so it flows through to the client's invoice.",
    skills: ["Disbursements", "GST inclusive vs exclusive"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Beltran purchase and go to TIME & DISBURSEMENTS.",
        hint: "Matters → 004182 → TIME & DISBURSEMENTS tab.",
        check: (s) => visitedTab(s, BELTRAN, "time"),
      },
      {
        kind: "action",
        instruction:
          "On the DISBURSEMENTS sub-tab, add a billable $99.00 disbursement for the council certificate.",
        hint: "Switch to the DISBURSEMENTS sub-tab, use the COUNC activity code, price 99.00, tick GST INC.",
        check: (s) =>
          logs(s, "disbursement.add").some(
            (l) =>
              l.matterId === BELTRAN &&
              mentionsAny(str(l.detail.subject), ["council", "rates", "certificate"]) &&
              typeof l.detail.amountExGst === "number" &&
              l.detail.amountExGst > 0,
          ),
      },
      {
        kind: "answer",
        instruction: "Check your understanding of the GST INC tick box.",
        hint: "$99.00 including GST means the GST is already inside that figure.",
        question: "You enter a price of $99.00 and tick GST INC. What does the system treat as the GST?",
        options: [
          "$9.90 — ten per cent added on top, making $108.90",
          "$9.00 — the GST already inside $99.00, leaving $90.00 excluding GST",
          "$0.00 — ticking GST INC means the item is GST-free",
          "$99.00 — the whole amount is GST",
        ],
        correct: 1,
        explanation:
          "GST INC means the figure you typed already contains the GST, so it is divided by 11: $9.00 GST on $90.00 ex-GST. Leaving the box unticked would add GST on top and over-charge the client by $9.90.",
      },
    ],
  },

  {
    id: "gt-clear-task",
    title: "Clear an overdue task",
    summary: "Read incoming mail, act on it, tick off the task, and leave a note behind.",
    difficulty: "Core",
    minutes: 7,
    brief:
      "Jennie has messaged you: the Beltrans' financier details are still not on file and settlement is 4 September. Check the matter's mail, then close out the overdue task and record what you found.",
    skills: ["Task management", "Emails", "Memos"],
    steps: [
      {
        kind: "action",
        instruction: "Open matter 004182 and read the EMAILS tab.",
        hint: "The client's own email mentions who their broker is.",
        check: (s) => visitedTab(s, BELTRAN, "emails"),
      },
      {
        kind: "action",
        instruction: "Go to the TASKS tab and mark \"Confirm financier details from client\" complete.",
        hint: "Tick the checkbox at the left of the task row.",
        check: (s) =>
          logs(s, "task.complete").some(
            (l) =>
              l.matterId === BELTRAN &&
              l.detail.completed === true &&
              mentionsAny(str(l.detail.name), ["financier"]),
          ),
      },
      {
        kind: "action",
        instruction: "Record a memo noting the financier / broker position on the file.",
        hint: "MEMOS tab → ADD MEMO. Mention the broker or the loan approval.",
        check: (s) =>
          logs(s, "memo.add").some(
            (l) =>
              l.matterId === BELTRAN &&
              mentionsAny(`${str(l.detail.title)} ${str(l.detail.body)}`, [
                "financier",
                "broker",
                "loan",
                "ridgeline",
                "mortgage",
              ]),
          ),
      },
      {
        kind: "answer",
        instruction: "Confirm what you should do next.",
        hint: "The client said the letter \"should come through this week\" — that is not the same as having it.",
        question:
          "The client says the loan approval letter is coming but has not sent it. What is the right next step?",
        options: [
          "Nothing — the task is ticked, the file is up to date",
          "Assume approval and book settlement in PEXA",
          "Leave a dated follow-up task to chase the approval letter, and tell the fee earner it is still outstanding",
          "Mark the matter as ready for settlement",
        ],
        correct: 2,
        explanation:
          "Ticking a task records that you actioned it, not that the underlying issue is resolved. Anything still outstanding needs a dated follow-up and a word to the fee earner — an unfunded purchaser on settlement day is the worst way to find out.",
      },
    ],
  },

  {
    id: "gt-create-matter",
    title: "Open a new matter",
    summary: "Take a new enquiry from scratch through the Create Matter wizard.",
    difficulty: "Advanced",
    minutes: 9,
    brief:
      "A new enquiry has come in. Dominic Ashcroft-Reyes is buying 5/40 Ferndale Road, Epping NSW 2121 from Marguerite Salvatierra. The other side is acting through Kellner Property Law. No contract has been received yet and no ID has been sighted. Open the matter.",
    skills: ["Create Matter wizard", "Risk assessment", "Data accuracy"],
    steps: [
      {
        kind: "action",
        instruction: "Open the Create Matter wizard.",
        hint: "NEW MATTER on the ribbon, or Matters in the left rail then ADD MATTER.",
        check: (s) => logs(s, "nav.create-matter").length > 0,
      },
      {
        kind: "action",
        instruction:
          "Work through the wizard and create the matter: NSW, Conveyancing, Purchase, client Ashcroft-Reyes, property on Ferndale Road.",
        hint: "Pick the state and matter type, press NEXT, then use the Quick Links down the left to move through Client/Contacts, Matter Details, Staff and Billing before pressing CREATE MATTER.",
        check: (s) =>
          logs(s, "matter.create").some(
            (l) =>
              l.detail.type === "Purchase" &&
              mentionsAny(str(l.detail.clientName), ["ashcroft"]) &&
              mentionsAny(str(l.detail.propertyAddress), ["ferndale"]),
          ),
      },
      {
        kind: "action",
        instruction: "Leave AML/KYC marked as not yet complete on the new matter.",
        hint: "No ID has been sighted, so the AML box must stay unticked — do not tick it to make the file look tidy.",
        check: (s) => logs(s, "matter.create").some((l) => l.detail.amlComplete === false),
      },
      {
        kind: "answer",
        instruction: "Check the risk-assessment reasoning.",
        hint: "What actually makes a file higher risk?",
        question:
          "The client wants to pay the deposit from an overseas account in a third party's name. How should that be handled?",
        options: [
          "Record it in the matter and carry on — how the client funds it is their business",
          "Refuse the matter outright",
          "Flag it for the fee earner as a source-of-funds and third-party-payer concern before accepting the money, and record the enquiry on the file",
          "Tick AML complete once the money arrives, since the funds cleared the bank",
        ],
        correct: 2,
        explanation:
          "Third-party and overseas payments are classic escalation triggers. A VA never clears these — you record what you were told and escalate to the fee earner before the money is accepted. Funds clearing a bank is not AML verification.",
      },
    ],
  },

  {
    id: "gt-daily-triage",
    title: "Triage the day's work",
    summary: "Use the dashboard and firm-wide task list to work out what actually has to happen today.",
    difficulty: "Beginner",
    minutes: 5,
    brief:
      "It's the start of your shift. Before touching anything, work out what is due today across every file you support, and which one is most urgent.",
    skills: ["Dashboard", "Firm-wide task list", "Prioritisation"],
    steps: [
      {
        kind: "action",
        instruction: "Open the firm-wide Tasks view from the left rail.",
        hint: "TASKS sits below CALENDAR on the left rail — this shows tasks across every matter, not just one file.",
        check: (s) => logs(s, "nav.rail").some((l) => l.detail.rail === "tasks"),
      },
      {
        kind: "answer",
        instruction: "Identify the most urgent item.",
        hint: "Sort your thinking by due date first, then priority. Today is 19 August 2026.",
        question: "Which task is the most urgent thing on the list today?",
        options: [
          "Order council and water certificates — Beltran purchase, due 21 August",
          "Prepare settlement adjustment sheet — Raghunathan sale, due today, Urgent",
          "Receive clear land tax certificate — Beltran purchase, no due date",
          "Send contract review report to client — Okonkwo purchase, due 20 August",
        ],
        correct: 1,
        explanation:
          "Due today and flagged Urgent, on a file settling on 27 August. The overdue Beltran financier task matters too, but the adjustment sheet is the one with a hard date attached to a settlement.",
      },
      {
        kind: "action",
        instruction: "Open the matter that urgent task belongs to.",
        hint: "It is the Raghunathan sale, matter 004176.",
        check: (s) => opened(s, RAGHUNATHAN),
      },
    ],
  },
];

export function getGuidedTask(id: string): GuidedTask | undefined {
  return GUIDED_TASKS.find((t) => t.id === id);
}
