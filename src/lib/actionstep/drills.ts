/**
 * Data-entry accuracy drills for the Actionstep simulator.
 *
 * Each drill hands the trainee a short source document and a blank version of
 * the fields a real workflow step would ask for, then scores what they typed
 * once they submit. These are standalone — they don't touch any seeded
 * matter or the guided-task log — so a drill can be retried freely without
 * disturbing anything else in the simulator.
 */

import type { Drill } from "@/lib/training/drill";

export const AS_DRILLS: Drill[] = [
  {
    id: "as-drill-instructions",
    title: "Log instructions from a client email",
    summary: "Pull the received date and referral source out of an intake email.",
    difficulty: "Beginner",
    minutes: 4,
    brief:
      "Jennie forwards you a new client's email. Before she can open the file, someone needs to record when instructions came in and how the client found the firm — neither is stated as a labelled field, so you have to read for it.",
    document: {
      heading: "Fwd: Purchase of 14 Marlowe Street",
      meta: "From: Amara Beltran · To: Jennie Tonner · Monday 11 May 2026, 9:14am",
      paragraphs: [
        "Hi Jennie, thanks for the call this morning. As discussed, please go ahead and open a file for the purchase of 14 Marlowe Street, Kellyville.",
        "Fenwick & Doyle showed us the property and recommended your firm, which is why I called — I hadn't used a conveyancer before.",
        "Let me know what you need from me.\nAmara",
      ],
    },
    fields: [
      { key: "instructionsDate", label: "Instructions received", type: "date" },
      {
        key: "referralSource",
        label: "Referral source",
        type: "choice",
        choices: ["Agent", "Past client", "Broker", "Online", "Walk-in"],
      },
    ],
    expected: { instructionsDate: "2026-05-11", referralSource: "Agent" },
  },

  {
    id: "as-drill-contract",
    title: "Enter contract particulars from a signed contract",
    summary: "Transcribe price, date and a special condition off a contract front page.",
    difficulty: "Core",
    minutes: 6,
    brief:
      "The signed contract for the Okonkwo purchase lands on your desk. Contract Review can't move on until the price and receipt date are on the file — get them right, because a wrong purchase price flows into every adjustment later.",
    document: {
      heading: "Contract for the Sale of Land — Particulars",
      meta: "Received by the firm 20 August 2026",
      paragraphs: [
        "Vendor: Priscilla Wenlock and Denis Wenlock",
        "Purchaser: Nathan Okonkwo",
        "Property: 61 Barrenjoey Grove, Baulkham Hills",
        "Price: One million, three hundred and ninety-five thousand dollars ($1,395,000.00)",
        "Special Condition 14: The cooling-off period under section 66W of the Conveyancing Act is waived by the purchaser's solicitor's certificate attached to this contract.",
      ],
    },
    fields: [
      { key: "contractReceived", label: "Contract received", type: "date" },
      { key: "purchasePrice", label: "Purchase price", type: "money" },
      {
        key: "coolingOffWaived",
        label: "Cooling-off waived (s66W)",
        type: "choice",
        choices: ["Yes", "No"],
      },
    ],
    expected: {
      contractReceived: "2026-08-20",
      purchasePrice: "1395000",
      coolingOffWaived: "Yes",
    },
  },

  {
    id: "as-drill-exchange",
    title: "Enter exchange figures from a confirmation letter",
    summary: "Work out the deposit from a percentage, and read off the two key dates.",
    difficulty: "Advanced",
    minutes: 7,
    brief:
      "Contracts exchange on the Beltran purchase this morning. The other side's lawyer sends a short confirmation letter — it states the deposit as a percentage, not a dollar figure, so you'll need to calculate it from the price before you can enter it.",
    document: {
      heading: "Confirmation of Exchange",
      meta: "Harrowgate Legal · 8 August 2026",
      paragraphs: [
        "We confirm contracts for the sale of 14 Marlowe Street, Kellyville exchanged today, 8 August 2026, at a price of $1,875,000.00.",
        "A deposit of 10% is payable and has been received into our trust account.",
        "Settlement is set for 4 September 2026. Please diarise accordingly.",
      ],
    },
    fields: [
      { key: "exchangeDate", label: "Exchange date", type: "date" },
      { key: "depositPaid", label: "Deposit paid", type: "money" },
      { key: "settlementDate", label: "Settlement date", type: "date" },
    ],
    expected: {
      exchangeDate: "2026-08-08",
      depositPaid: "187500",
      settlementDate: "2026-09-04",
    },
  },
];
