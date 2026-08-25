/**
 * Seeded workflows and matters for the Actionstep simulator.
 *
 * The matters mirror the files in the other simulators so a trainee moving
 * between systems recognises them. Everything is invented.
 */

import type {
  AsFileNote,
  AsMatter,
  AsState,
  AsTask,
  AsTimeEntry,
  AsWorkflow,
} from "./types";

export const AS_TODAY = "2026-08-19";

export const AS_USER = { name: "Shane Capati", firm: "Cremorne Conveyancing" };

export const AS_STAFF = ["Shane Capati", "Jennie Tonner", "Harold Galvo", "Monika Stelzner"];

const YES_NO = ["Yes", "No"];

const purchaseWorkflow: AsWorkflow = {
  matterType: "Conveyancing — Purchase",
  steps: [
    {
      id: "p-1",
      name: "Instructions Received",
      order: 1,
      description: "Client has engaged the firm. Open the file and confirm who we act for.",
      requiredParticipantTypes: ["Client"],
      dataFields: [
        { key: "instructionsDate", label: "Instructions received", type: "date", required: true },
        {
          key: "referralSource",
          label: "Referral source",
          type: "choice",
          choices: ["Agent", "Past client", "Broker", "Online", "Walk-in"],
          required: false,
        },
      ],
      tasks: ["Send engagement letter and cost disclosure", "Verify client identity (AML/KYC)"],
      documents: ["Engagement letter"],
    },
    {
      id: "p-2",
      name: "Contract Review",
      order: 2,
      description: "Review the contract and report to the client before they commit.",
      requiredParticipantTypes: ["Client", "Other Side Lawyer"],
      dataFields: [
        { key: "contractReceived", label: "Contract received", type: "date", required: true },
        { key: "purchasePrice", label: "Purchase price", type: "money", required: true },
        {
          key: "coolingOffWaived",
          label: "Cooling-off waived (s66W)",
          type: "choice",
          choices: YES_NO,
          required: false,
        },
      ],
      tasks: ["Prepare contract review report", "Raise requisitions on title"],
      documents: ["Contract review report"],
    },
    {
      id: "p-3",
      name: "Exchange",
      order: 3,
      description: "Contracts exchanged. Key dates now drive the rest of the file.",
      requiredParticipantTypes: ["Client", "Other Side Lawyer"],
      dataFields: [
        { key: "exchangeDate", label: "Exchange date", type: "date", required: true },
        { key: "depositPaid", label: "Deposit paid", type: "money", required: true },
        { key: "settlementDate", label: "Settlement date", type: "date", required: true },
      ],
      tasks: ["Diarise settlement date", "Order council, water and title searches"],
      documents: ["Letter to client — post exchange"],
    },
    {
      id: "p-4",
      name: "Pre-Settlement",
      order: 4,
      description:
        "Everything that must be in place before settlement: finance, searches, adjustments.",
      // The incoming lender must be on the matter before this step can close.
      requiredParticipantTypes: ["Client", "Other Side Lawyer", "Incoming Lender"],
      dataFields: [
        {
          key: "searchesComplete",
          label: "Searches returned",
          type: "choice",
          choices: YES_NO,
          required: true,
        },
        {
          key: "adjustmentsPrepared",
          label: "Adjustments prepared",
          type: "choice",
          choices: YES_NO,
          required: true,
        },
        { key: "financeApproved", label: "Finance approval date", type: "date", required: false },
      ],
      tasks: ["Prepare settlement adjustment sheet", "Book settlement in PEXA"],
      documents: ["Settlement adjustment sheet"],
    },
    {
      id: "p-5",
      name: "Settlement",
      order: 5,
      description: "Settlement day.",
      requiredParticipantTypes: ["Client", "Other Side Lawyer", "Incoming Lender"],
      dataFields: [
        { key: "settledOn", label: "Settled on", type: "date", required: true },
      ],
      tasks: ["Attend settlement", "Notify client and agent of settlement"],
      documents: ["Settlement statement"],
    },
    {
      id: "p-6",
      name: "Post Settlement",
      order: 6,
      description: "Final reporting and archiving.",
      requiredParticipantTypes: [],
      dataFields: [],
      tasks: ["Send final report to client", "Archive file"],
      documents: ["Final report to client"],
    },
  ],
};

const saleWorkflow: AsWorkflow = {
  matterType: "Conveyancing — Sale",
  steps: [
    {
      id: "s-1",
      name: "Instructions Received",
      order: 1,
      description: "Vendor has engaged the firm.",
      requiredParticipantTypes: ["Client"],
      dataFields: [
        { key: "instructionsDate", label: "Instructions received", type: "date", required: true },
      ],
      tasks: ["Send engagement letter and cost disclosure", "Verify client identity (AML/KYC)"],
      documents: ["Engagement letter"],
    },
    {
      id: "s-2",
      name: "Contract Preparation",
      order: 2,
      description: "Prepare the contract so the property can be marketed.",
      requiredParticipantTypes: ["Client", "Real Estate Agent"],
      dataFields: [
        { key: "listingPrice", label: "Listing price", type: "money", required: false },
        {
          key: "vendorDisclosure",
          label: "Vendor disclosure documents complete",
          type: "choice",
          choices: YES_NO,
          required: true,
        },
      ],
      tasks: ["Order vendor disclosure documents", "Prepare contract for sale"],
      documents: ["Contract for sale"],
    },
    {
      id: "s-3",
      name: "Exchange",
      order: 3,
      description: "Contracts exchanged with the purchaser.",
      requiredParticipantTypes: ["Client", "Other Side Lawyer"],
      dataFields: [
        { key: "exchangeDate", label: "Exchange date", type: "date", required: true },
        { key: "settlementDate", label: "Settlement date", type: "date", required: true },
      ],
      tasks: ["Diarise settlement date"],
      documents: ["Letter to client — post exchange"],
    },
    {
      id: "s-4",
      name: "Pre-Settlement",
      order: 4,
      description: "Discharge the mortgage and agree adjustments.",
      requiredParticipantTypes: ["Client", "Other Side Lawyer", "Outgoing Lender"],
      dataFields: [
        {
          key: "dischargeSent",
          label: "Discharge authority sent",
          type: "choice",
          choices: YES_NO,
          required: true,
        },
      ],
      tasks: ["Send discharge authority to lender", "Confirm discharge in PEXA"],
      documents: ["Discharge authority"],
    },
    {
      id: "s-5",
      name: "Settlement",
      order: 5,
      description: "Settlement day.",
      requiredParticipantTypes: ["Client", "Other Side Lawyer"],
      dataFields: [{ key: "settledOn", label: "Settled on", type: "date", required: true }],
      tasks: ["Attend settlement", "Authorise release of deposit"],
      documents: ["Settlement statement"],
    },
    {
      id: "s-6",
      name: "Post Settlement",
      order: 6,
      description: "Final reporting and archiving.",
      requiredParticipantTypes: [],
      dataFields: [],
      tasks: ["Send final report to client", "Archive file"],
      documents: ["Final report to client"],
    },
  ],
};

const matters: AsMatter[] = [
  {
    id: "am-1",
    actionId: 10482,
    name: "Beltran — Purchase of 14 Marlowe Street, Kellyville",
    matterType: "Conveyancing — Purchase",
    status: "Active",
    // Sitting at Pre-Settlement and deliberately blocked: no Incoming Lender
    // on the matter and two required fields unanswered.
    currentStepId: "p-4",
    stepHistory: [
      { id: "sh-1", stepId: "p-1", enteredAt: "2026-05-11", exitedAt: "2026-05-19" },
      { id: "sh-2", stepId: "p-2", enteredAt: "2026-05-19", exitedAt: "2026-07-28" },
      { id: "sh-3", stepId: "p-3", enteredAt: "2026-07-28", exitedAt: "2026-08-11" },
      { id: "sh-4", stepId: "p-4", enteredAt: "2026-08-11", exitedAt: null },
    ],
    participants: [
      {
        id: "ap-1",
        name: "Amara Beltran",
        participantType: "Client",
        email: "amara.beltran@examplemail.com",
        phone: "+61 412 908 553",
      },
      {
        id: "ap-2",
        name: "Bianca Oyelaran — Harrowgate Legal",
        participantType: "Other Side Lawyer",
        email: "bianca@harrowgatelegal.example",
        phone: "02 8835 1124",
      },
    ],
    dataValues: {
      instructionsDate: "2026-05-11",
      referralSource: "Agent",
      contractReceived: "2026-05-22",
      purchasePrice: "1875000",
      coolingOffWaived: "Yes",
      exchangeDate: "2026-08-08",
      depositPaid: "187500",
      settlementDate: "2026-09-04",
    },
    openedAt: "2026-05-11",
    assignedTo: "Jennie Tonner",
  },
  {
    id: "am-2",
    actionId: 10476,
    name: "Raghunathan — Sale of 8/22 Kestrel Parade, Chatswood",
    matterType: "Conveyancing — Sale",
    status: "Active",
    currentStepId: "s-4",
    stepHistory: [
      { id: "sh-5", stepId: "s-1", enteredAt: "2026-06-02", exitedAt: "2026-06-08" },
      { id: "sh-6", stepId: "s-2", enteredAt: "2026-06-08", exitedAt: "2026-06-26" },
      { id: "sh-7", stepId: "s-3", enteredAt: "2026-06-26", exitedAt: "2026-08-05" },
      { id: "sh-8", stepId: "s-4", enteredAt: "2026-08-05", exitedAt: null },
    ],
    participants: [
      {
        id: "ap-3",
        name: "Priya Raghunathan",
        participantType: "Client",
        email: "p.raghunathan@examplemail.com",
        phone: "+61 438 221 070",
      },
      {
        id: "ap-4",
        name: "Marcus Delacourt — Delacourt & Vine",
        participantType: "Other Side Lawyer",
        email: "marcus@delacourtvine.example",
        phone: "02 9412 6600",
      },
      {
        id: "ap-5",
        name: "Meridian Bank",
        participantType: "Outgoing Lender",
        email: "discharges@meridianbank.example",
        phone: "13 20 40",
      },
      {
        id: "ap-6",
        name: "Fenwick & Doyle Property",
        participantType: "Real Estate Agent",
        email: "sales@fenwickdoyle.example",
        phone: "02 9411 8800",
      },
    ],
    dataValues: {
      instructionsDate: "2026-06-02",
      listingPrice: "1150000",
      vendorDisclosure: "Yes",
      exchangeDate: "2026-07-24",
      settlementDate: "2026-08-27",
      dischargeSent: "Yes",
    },
    openedAt: "2026-06-02",
    assignedTo: "Shane Capati",
  },
  {
    id: "am-3",
    actionId: 10490,
    name: "Okonkwo — Purchase of 61 Barrenjoey Grove, Baulkham Hills",
    matterType: "Conveyancing — Purchase",
    status: "Active",
    currentStepId: "p-2",
    stepHistory: [
      { id: "sh-9", stepId: "p-1", enteredAt: "2026-08-04", exitedAt: "2026-08-16" },
      { id: "sh-10", stepId: "p-2", enteredAt: "2026-08-16", exitedAt: null },
    ],
    participants: [
      {
        id: "ap-7",
        name: "Nathan Okonkwo",
        participantType: "Client",
        email: "n.okonkwo@examplemail.com",
        phone: "+61 401 774 316",
      },
    ],
    dataValues: { instructionsDate: "2026-08-04", referralSource: "Broker" },
    openedAt: "2026-08-04",
    assignedTo: "Jennie Tonner",
  },
  {
    id: "am-4",
    actionId: 10441,
    // A finished file. The Matters screen defaults to hiding Closed matters,
    // so this one exists specifically to be the thing that isn't there when
    // you go looking for it — see the "Find a matter that isn't there"
    // scenario.
    name: "Nakamura — Sale of 22 Silverwater Lane, Hornsby",
    matterType: "Conveyancing — Sale",
    status: "Closed",
    currentStepId: "s-6",
    stepHistory: [
      { id: "sh-11", stepId: "s-1", enteredAt: "2026-04-02", exitedAt: "2026-04-09" },
      { id: "sh-12", stepId: "s-2", enteredAt: "2026-04-09", exitedAt: "2026-04-30" },
      { id: "sh-13", stepId: "s-3", enteredAt: "2026-04-30", exitedAt: "2026-05-14" },
      { id: "sh-14", stepId: "s-4", enteredAt: "2026-05-14", exitedAt: "2026-06-08" },
      { id: "sh-15", stepId: "s-5", enteredAt: "2026-06-08", exitedAt: "2026-06-12" },
      { id: "sh-16", stepId: "s-6", enteredAt: "2026-06-12", exitedAt: null },
    ],
    participants: [
      {
        id: "ap-8",
        name: "Sora Nakamura",
        participantType: "Client",
        email: "sora.nakamura@examplemail.com",
        phone: "+61 407 220 981",
      },
      {
        id: "ap-9",
        name: "Devon Ashwell — Ashwell & Co",
        participantType: "Other Side Lawyer",
        email: "devon@ashwellco.example",
        phone: "02 9887 1200",
      },
    ],
    dataValues: {
      instructionsDate: "2026-04-02",
      listingPrice: "980000",
      vendorDisclosure: "Yes",
      exchangeDate: "2026-04-28",
      settlementDate: "2026-06-12",
      dischargeSent: "Yes",
      settledOn: "2026-06-12",
    },
    openedAt: "2026-04-02",
    assignedTo: "Shane Capati",
  },
];

const fileNotes: AsFileNote[] = [
  {
    id: "fn-1",
    matterId: "am-1",
    text: "Other side confirmed vacant possession on settlement. Tenant vacated 2 August.",
    author: "Shane Capati",
    createdAt: "2026-08-18",
  },
  {
    id: "fn-2",
    matterId: "am-2",
    text: "Lender confirmed the discharge will be ready three business days before settlement.",
    author: "Shane Capati",
    createdAt: "2026-08-12",
  },
  {
    id: "fn-3",
    matterId: "am-4",
    text: "Settled without incident. Final report and invoice sent to client; file archived.",
    author: "Shane Capati",
    createdAt: "2026-06-12",
  },
];

const tasks: AsTask[] = [
  {
    id: "at-1",
    matterId: "am-1",
    name: "Prepare settlement adjustment sheet",
    assignedTo: "Shane Capati",
    dueOn: "2026-08-28",
    completedOn: null,
    fromStepId: "p-4",
  },
  {
    id: "at-2",
    matterId: "am-1",
    name: "Book settlement in PEXA",
    assignedTo: "Shane Capati",
    dueOn: "2026-08-30",
    completedOn: null,
    fromStepId: "p-4",
  },
  {
    id: "at-3",
    matterId: "am-2",
    name: "Confirm discharge in PEXA",
    assignedTo: "Shane Capati",
    dueOn: "2026-08-24",
    completedOn: null,
    fromStepId: "s-4",
  },
  {
    id: "at-4",
    matterId: "am-3",
    name: "Prepare contract review report",
    assignedTo: "Jennie Tonner",
    dueOn: "2026-08-20",
    completedOn: null,
    fromStepId: "p-2",
  },
  {
    id: "at-5",
    matterId: "am-4",
    name: "Send final report to client",
    assignedTo: "Shane Capati",
    dueOn: "2026-06-15",
    completedOn: "2026-06-13",
    fromStepId: "s-6",
  },
  {
    id: "at-6",
    matterId: "am-4",
    name: "Archive file",
    assignedTo: "Shane Capati",
    dueOn: "2026-06-15",
    completedOn: "2026-06-13",
    fromStepId: "s-6",
  },
];

const timeEntries: AsTimeEntry[] = [
  {
    id: "ate-1",
    matterId: "am-1",
    date: "2026-08-14",
    staff: "Shane Capati",
    description: "Letter to client following exchange",
    hours: 0.3,
    rate: 350,
    billable: true,
  },
  {
    id: "ate-2",
    matterId: "am-2",
    date: "2026-08-12",
    staff: "Shane Capati",
    description: "Telephone attendance on lender re discharge",
    hours: 0.4,
    rate: 350,
    billable: true,
  },
];

export function createAsSeedState(): AsState {
  return {
    today: AS_TODAY,
    user: AS_USER,
    workflows: [purchaseWorkflow, saleWorkflow],
    matters: matters.map((m) => ({
      ...m,
      participants: m.participants.map((p) => ({ ...p })),
      stepHistory: m.stepHistory.map((h) => ({ ...h })),
      dataValues: { ...m.dataValues },
    })),
    fileNotes: [...fileNotes],
    tasks: [...tasks],
    timeEntries: [...timeEntries],
    // The Beltran purchase is the one actively being chased, so it starts
    // starred — same as a VA would pin the file they're mid-way through.
    starredMatterIds: ["am-1"],
    matterListFilter: { status: "Active" },
    nav: { screen: "home", matterId: null, tab: "home" },
    log: [],
  };
}
