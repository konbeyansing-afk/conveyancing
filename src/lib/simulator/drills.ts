/**
 * Data-entry accuracy drills for the practice-management-system simulator.
 *
 * Same pattern as the Actionstep and PEXA simulators' drill modes: a source
 * document, a blank form, scoring only revealed on submit. These are
 * standalone — they don't touch any seeded matter — so a drill can be
 * retried freely without disturbing anything else.
 */

import type { Drill } from "@/lib/training/drill";
import { SIM_STAFF } from "./seed";
import { AU_STATES } from "./types";

export const SIM_DRILLS: Drill[] = [
  {
    id: "sim-drill-open-matter",
    title: "Open a matter from a referral email",
    summary: "Pull the property address, state and area of law out of an internal email.",
    difficulty: "Beginner",
    minutes: 4,
    brief:
      "Jennie forwards a new instruction and asks you to get the file open. Nothing in the email is labelled the way the Matter Info screen expects — you have to read it for what the wizard needs.",
    document: {
      heading: "Fwd: New instructions — please open a file",
      meta: "From: Jennie Tonner · Thursday 20 August 2026, 10:03am",
      paragraphs: [
        "Hi, can you open a new matter — purchase of 12 Bellevue Terrace, Neutral Bay. Client instructed us this morning.",
        "It's a Sydney property, straightforward conveyancing, nothing unusual.",
      ],
    },
    fields: [
      { key: "propertyAddress", label: "Property address", type: "text" },
      { key: "state", label: "State", type: "choice", choices: [...AU_STATES] },
      { key: "areaOfLaw", label: "Area of law", type: "choice", choices: ["Conveyancing", "Leasing", "Estates"] },
    ],
    expected: {
      propertyAddress: "12 Bellevue Terrace, Neutral Bay",
      state: "NSW",
      areaOfLaw: "Conveyancing",
    },
  },

  {
    id: "sim-drill-phone-message",
    title: "Take a phone message accurately",
    summary: "Capture the caller's number and route the message to the right person.",
    difficulty: "Core",
    minutes: 5,
    brief:
      "Reception takes a call while the fee earner is out and passes you the details to log. A phone message is only useful if it reaches the right person with the right number to call back — get either wrong and it's worse than not taking the message at all.",
    document: {
      heading: "While you were away — phone message",
      meta: "Reception note, 2:14pm",
      paragraphs: [
        "Call for Cremorne Conveyancing. Caller: Priya Raghunathan, mobile 0438 221 070.",
        "She's asking whether the purchaser has confirmed access before settlement to measure for blinds — nothing agreed yet.",
        "Please pass this to Shane, it's his file.",
      ],
    },
    fields: [
      { key: "caller", label: "Caller", type: "text" },
      { key: "callerPhone", label: "Caller's phone", type: "text" },
      { key: "forStaff", label: "Message for", type: "choice", choices: [...SIM_STAFF] },
    ],
    expected: {
      caller: "Priya Raghunathan",
      callerPhone: "0438 221 070",
      forStaff: "Shane Capati",
    },
  },

  {
    id: "sim-drill-contract-particulars",
    title: "Enter purchase figures from a contract of sale",
    summary: "Transcribe the price and settlement date, and calculate the deposit.",
    difficulty: "Advanced",
    minutes: 6,
    brief:
      "The signed contract lands on your desk. The deposit isn't stated as a dollar figure — it's a percentage of the price — so you'll need to calculate it before it goes on the Matter Info screen. Get the purchase price wrong here and every adjustment for the rest of the file is wrong too.",
    document: {
      heading: "Contract for Sale of Land — Particulars",
      meta: "Received 21 August 2026",
      paragraphs: [
        "Vendor: Priscilla Wenlock and Denis Wenlock. Purchaser: Devika Okonkwo-Ryan.",
        "Property: 12 Bellevue Terrace, Neutral Bay NSW 2089.",
        "Price: Eight hundred and forty thousand dollars ($840,000.00).",
        "Deposit: 5% of the purchase price, payable on exchange.",
        "Settlement: 42 days from exchange, being 3 October 2026.",
      ],
    },
    fields: [
      { key: "purchasePrice", label: "Purchase price", type: "money" },
      { key: "depositPaid", label: "Deposit", type: "money" },
      { key: "settlementDate", label: "Settlement date", type: "date" },
    ],
    expected: {
      purchasePrice: "840000",
      depositPaid: "42000",
      settlementDate: "2026-10-03",
    },
  },
];
