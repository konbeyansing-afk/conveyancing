/**
 * Seeded workspaces for the PEXA simulator.
 *
 * These mirror the matters in the practice-management simulator so a trainee
 * moving between the two sees the same files. Everything is invented.
 */

import type { PexaNotification, PexaState, PexaWorkspace } from "./types";

export const PEXA_TODAY = "2026-08-19";

export const PEXA_USER = {
  name: "Shane Capati",
  subscriber: "Cremorne Conveyancing",
};

/** Other firms and lenders that can be invited into a workspace. */
export const SUBSCRIBERS = [
  "Harrowgate Legal",
  "Delacourt & Vine Conveyancing",
  "Pemberton Waye Lawyers",
  "Northbrook Conveyancing",
  "Meridian Bank",
  "Ridgeline Finance",
  "Anvil Mutual Bank",
  "Southcape Credit Union",
];

const workspaces: PexaWorkspace[] = [
  {
    id: "ws-1",
    workspaceNumber: "PX-4482193",
    jurisdiction: "NSW",
    titleReference: "42/1104882",
    propertyAddress: "14 Marlowe Street, Kellyville NSW 2155",
    matterNumber: "004182",
    ourRole: "Incoming Proprietor",
    settlementDate: "2026-09-04",
    settlementTime: "2:00 PM",
    proposedBy: "Cremorne Conveyancing",
    // Only we have accepted so far — the other side hasn't confirmed.
    acceptedBy: ["p-1a"],
    status: "In Preparation",
    hasFinancialSettlement: true,
    participants: [
      {
        id: "p-1a",
        subscriberName: "Cremorne Conveyancing",
        role: "Incoming Proprietor",
        accepted: true,
        isSelf: true,
        invitedAt: null,
      },
      {
        id: "p-1b",
        subscriberName: "Harrowgate Legal",
        role: "Proprietor on Title",
        accepted: true,
        isSelf: false,
        invitedAt: "2026-08-10",
      },
    ],
    documents: [
      {
        id: "d-1a",
        type: "Transfer",
        status: "Draft",
        responsibleRole: "Incoming Proprietor",
        signedBy: null,
        signedAt: null,
      },
    ],
    funds: [
      {
        id: "f-1a",
        direction: "Destination",
        category: "Duty",
        description: "Transfer duty — Revenue NSW",
        amount: 84265,
        locked: true,
      },
      {
        id: "f-1b",
        direction: "Destination",
        category: "Lodgement fee",
        description: "Land registry lodgement fee",
        amount: 172.4,
        locked: true,
      },
      {
        id: "f-1c",
        direction: "Destination",
        category: "PEXA fee",
        description: "PEXA transaction fee",
        amount: 130.9,
        locked: true,
      },
    ],
  },
  {
    id: "ws-2",
    workspaceNumber: "PX-4471088",
    jurisdiction: "NSW",
    titleReference: "8/SP91442",
    propertyAddress: "8/22 Kestrel Parade, Chatswood NSW 2067",
    matterNumber: "004176",
    ourRole: "Proprietor on Title",
    settlementDate: "2026-08-27",
    settlementTime: "11:00 AM",
    proposedBy: "Delacourt & Vine Conveyancing",
    acceptedBy: ["p-2a", "p-2b", "p-2c"],
    status: "Booked",
    hasFinancialSettlement: true,
    participants: [
      {
        id: "p-2a",
        subscriberName: "Cremorne Conveyancing",
        role: "Proprietor on Title",
        accepted: true,
        isSelf: true,
        invitedAt: null,
      },
      {
        id: "p-2b",
        subscriberName: "Delacourt & Vine Conveyancing",
        role: "Incoming Proprietor",
        accepted: true,
        isSelf: false,
        invitedAt: "2026-07-30",
      },
      {
        id: "p-2c",
        subscriberName: "Meridian Bank",
        role: "Mortgagee on Title",
        accepted: true,
        isSelf: false,
        invitedAt: "2026-08-11",
      },
    ],
    documents: [
      {
        id: "d-2a",
        type: "Discharge of Mortgage",
        status: "Signed",
        responsibleRole: "Mortgagee on Title",
        signedBy: "Meridian Bank",
        signedAt: "2026-08-18",
      },
      {
        id: "d-2b",
        type: "Transfer",
        status: "Signed",
        responsibleRole: "Incoming Proprietor",
        signedBy: "Delacourt & Vine Conveyancing",
        signedAt: "2026-08-18",
      },
    ],
    funds: [
      {
        id: "f-2a",
        direction: "Source",
        category: "Purchaser funds",
        description: "Balance of purchase price",
        amount: 1026000,
        locked: false,
      },
      {
        id: "f-2b",
        direction: "Destination",
        category: "Discharge of mortgage",
        description: "Payout to Meridian Bank",
        amount: 612480.35,
        locked: false,
      },
      {
        id: "f-2c",
        direction: "Destination",
        category: "Agent commission",
        description: "Fenwick & Doyle Property — commission",
        amount: 22800,
        locked: false,
      },
      {
        id: "f-2d",
        direction: "Destination",
        category: "PEXA fee",
        description: "PEXA transaction fee",
        amount: 130.9,
        locked: true,
      },
      // Deliberately short — the schedule does not balance yet, which is what
      // the trainee has to notice and fix.
      {
        id: "f-2e",
        direction: "Destination",
        category: "Vendor proceeds",
        description: "Balance to vendor",
        amount: 389919.1,
        locked: false,
      },
    ],
  },
  {
    id: "ws-3",
    workspaceNumber: "PX-4463550",
    jurisdiction: "NSW",
    titleReference: "5/220741",
    propertyAddress: "3 Wenlock Close, Castle Hill NSW 2154",
    matterNumber: "004168",
    ourRole: "Incoming Proprietor",
    settlementDate: null,
    settlementTime: null,
    proposedBy: null,
    acceptedBy: [],
    status: "In Preparation",
    // A survivorship-style transfer with no money changing hands.
    hasFinancialSettlement: false,
    participants: [
      {
        id: "p-3a",
        subscriberName: "Cremorne Conveyancing",
        role: "Incoming Proprietor",
        accepted: true,
        isSelf: true,
        invitedAt: null,
      },
    ],
    documents: [],
    funds: [],
  },
];

const notifications: PexaNotification[] = [
  {
    id: "n-1",
    workspaceId: "ws-2",
    message: "Meridian Bank signed the Discharge of Mortgage.",
    at: "2026-08-18 4:12 PM",
    unread: true,
  },
  {
    id: "n-2",
    workspaceId: "ws-2",
    message:
      "Delacourt & Vine Conveyancing accepted the settlement date and time of 27/08/2026 11:00 AM.",
    at: "2026-08-18 2:35 PM",
    unread: true,
  },
  {
    id: "n-3",
    workspaceId: "ws-1",
    message: "Harrowgate Legal joined the workspace as Proprietor on Title.",
    at: "2026-08-10 9:48 AM",
    unread: false,
  },
];

export function createPexaSeedState(): PexaState {
  return {
    today: PEXA_TODAY,
    user: PEXA_USER,
    workspaces: workspaces.map((w) => ({
      ...w,
      participants: w.participants.map((p) => ({ ...p })),
      documents: w.documents.map((d) => ({ ...d })),
      funds: w.funds.map((f) => ({ ...f })),
      acceptedBy: [...w.acceptedBy],
    })),
    notifications: notifications.map((n) => ({ ...n })),
    nav: { screen: "dashboard", workspaceId: null, tab: "summary" },
    log: [],
  };
}
