/**
 * Data-entry accuracy drills for the PEXA workspace simulator.
 *
 * PEXA's Financial Settlement Schedule has to balance to the cent, and every
 * line on it has two classifications that have to be right before the
 * amount even matters: which direction the money moves (Source into the
 * schedule, or Destination out of it) and which category it belongs to.
 * These drills are standalone — they don't touch any seeded workspace — so
 * a drill can be retried freely without disturbing anything else.
 */

import type { Drill } from "@/lib/training/drill";

export const PEXA_DRILLS: Drill[] = [
  {
    id: "pexa-drill-workspace-particulars",
    title: "Open a workspace from a referral memo",
    summary: "Pull the title reference, matter number and jurisdiction out of an internal email.",
    difficulty: "Beginner",
    minutes: 4,
    brief:
      "Jennie forwards a new sale and asks you to get the PEXA workspace open. None of it is laid out as labelled fields — you have to read the memo for the numbers that matter.",
    document: {
      heading: "Fwd: New sale — please open PEXA workspace",
      meta: "From: Jennie Tonner · Tuesday 18 August 2026, 8:52am",
      paragraphs: [
        "Morning — can you set up the PEXA workspace for the Okafor sale this morning, the agent's chasing us.",
        "Title reference is 17/889204, our matter number is 004203. It's a Sydney property so the usual jurisdiction applies.",
        "Thanks, Jennie",
      ],
    },
    fields: [
      { key: "titleReference", label: "Title reference", type: "text" },
      { key: "matterNumber", label: "Matter number", type: "text" },
      { key: "jurisdiction", label: "Jurisdiction", type: "choice", choices: ["NSW", "QLD", "VIC", "SA", "WA", "TAS", "NT", "ACT"] },
    ],
    expected: { titleReference: "17/889204", matterNumber: "004203", jurisdiction: "NSW" },
  },

  {
    id: "pexa-drill-discharge-figure",
    title: "Enter a discharge figure onto the settlement schedule",
    summary: "Classify a payout letter correctly and transcribe the figure.",
    difficulty: "Core",
    minutes: 5,
    brief:
      "The outgoing lender's payout letter arrives. Before you can enter the amount, you have to get the classification right — which direction it moves, and which category it belongs to — or the schedule won't balance to what settlement actually needs.",
    document: {
      heading: "Payout Figures — Meridian Bank",
      meta: "Mortgage account 88213-04 · secured over 6 Isabella Court, Merrylands NSW",
      paragraphs: [
        "The figure to discharge our mortgage, current for settlement on 2 September 2026, is $486,214.70.",
        "This amount must be received by 2:00pm on the settlement date or the figure will lapse and a new letter will be required.",
      ],
    },
    fields: [
      { key: "direction", label: "Direction", type: "choice", choices: ["Source", "Destination"] },
      {
        key: "category",
        label: "Category",
        type: "choice",
        choices: [
          "Discharge of mortgage",
          "Vendor proceeds",
          "Council rates adjustment",
          "Water rates adjustment",
          "Land tax adjustment",
          "Agent commission",
          "Duty",
          "Lodgement fee",
          "PEXA fee",
        ],
      },
      { key: "amount", label: "Amount", type: "money" },
    ],
    expected: { direction: "Destination", category: "Discharge of mortgage", amount: "486214.70" },
  },

  {
    id: "pexa-drill-agent-commission",
    title: "Enter the agent's commission from a percentage-based invoice",
    summary: "Work out a dollar figure from a commission percentage before entering it.",
    difficulty: "Advanced",
    minutes: 6,
    brief:
      "The selling agent's commission advice states a percentage, not a dollar figure. You'll need to calculate it from the sale price before it can go on the schedule — get it wrong and the whole schedule stops balancing on settlement day.",
    document: {
      heading: "Commission Advice",
      meta: "Harrow & Vale Real Estate",
      paragraphs: [
        "RE: Sale of 9 Harrow Lane, Baulkham Hills NSW — sale price $912,000.00.",
        "Our commission is 2.2% of the sale price (inclusive of GST), payable from settlement proceeds as agreed in the agency agreement.",
      ],
    },
    fields: [
      { key: "direction", label: "Direction", type: "choice", choices: ["Source", "Destination"] },
      {
        key: "category",
        label: "Category",
        type: "choice",
        choices: [
          "Discharge of mortgage",
          "Vendor proceeds",
          "Council rates adjustment",
          "Water rates adjustment",
          "Land tax adjustment",
          "Agent commission",
          "Duty",
          "Lodgement fee",
          "PEXA fee",
        ],
      },
      { key: "amount", label: "Amount", type: "money" },
    ],
    expected: { direction: "Destination", category: "Agent commission", amount: "20064" },
  },
];
