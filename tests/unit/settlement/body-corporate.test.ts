/**
 * Body Corporate adjustment engine — same proration shape as Council Rates,
 * with levy-type differentiation and a special-levy notice.
 */

import { describe, expect, it } from "vitest";
import {
  calculateBodyCorporateAdjustment,
  newBodyCorporateAdjustmentInput,
  type BodyCorporateAdjustmentInput,
} from "@/lib/settlement/adjustments/bodyCorporate";
import { dollarsToCents } from "@/lib/settlement/money";

function readyInput(patch: Partial<BodyCorporateAdjustmentInput> = {}): BodyCorporateAdjustmentInput {
  return {
    ...newBodyCorporateAdjustmentInput("bc1"),
    label: "Admin Fund",
    levyAmountCents: dollarsToCents(600),
    periodStart: "2026-07-01",
    periodEnd: "2026-09-30", // quarterly, 92 days
    noticeConfirmedCurrent: true,
    paymentStatus: "PAID_BY_SELLER",
    ...patch,
  };
}

describe("calculateBodyCorporateAdjustment — quarterly levy", () => {
  it("prorates a quarterly admin fund levy by settlement date", () => {
    const result = calculateBodyCorporateAdjustment(readyInput(), { settlementDate: "2026-08-15" });
    expect(result.tier).toBe("ok");
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Period days"]).toBe("92");
  });

  it("each levy type independently produces its own adjustment", () => {
    const admin = calculateBodyCorporateAdjustment(readyInput({ levyType: "ADMIN_FUND" }), {
      settlementDate: "2026-08-15",
    });
    const sinking = calculateBodyCorporateAdjustment(
      readyInput({ levyType: "SINKING_FUND", levyAmountCents: dollarsToCents(300) }),
      { settlementDate: "2026-08-15" },
    );
    expect(admin.effective!.ledgerEntries[0].amountCents).not.toBe(sinking.effective!.ledgerEntries[0].amountCents);
  });
});

describe("calculateBodyCorporateAdjustment — special levy", () => {
  it("carries an info-tier notice to confirm treatment with the body corporate manager", () => {
    const result = calculateBodyCorporateAdjustment(readyInput({ levyType: "SPECIAL_LEVY" }), {
      settlementDate: "2026-08-15",
    });
    expect(result.messages.some((m) => m.tier === "info" && /special levy/i.test(m.text))).toBe(true);
  });

  it("a non-special levy carries no such notice", () => {
    const result = calculateBodyCorporateAdjustment(readyInput({ levyType: "ADMIN_FUND" }), {
      settlementDate: "2026-08-15",
    });
    expect(result.messages.some((m) => /special levy/i.test(m.text))).toBe(false);
  });
});

describe("calculateBodyCorporateAdjustment — payment direction", () => {
  it("buyer debit / seller credit when the seller already paid", () => {
    const result = calculateBodyCorporateAdjustment(readyInput({ paymentStatus: "PAID_BY_SELLER" }), {
      settlementDate: "2026-08-15",
    });
    expect(result.effective!.ledgerEntries.find((e) => e.party === "BUYER")?.side).toBe("DEBIT");
  });

  it("seller debit / buyer credit when not yet paid", () => {
    const result = calculateBodyCorporateAdjustment(readyInput({ paymentStatus: "NOT_YET_PAID" }), {
      settlementDate: "2026-08-15",
    });
    expect(result.effective!.ledgerEntries.find((e) => e.party === "SELLER")?.side).toBe("DEBIT");
  });
});

describe("calculateBodyCorporateAdjustment — partial period", () => {
  it("settlement mid-period splits correctly", () => {
    const result = calculateBodyCorporateAdjustment(readyInput(), { settlementDate: "2026-07-16" });
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Seller days (to and including settlement)"]).toBe("16");
    expect(trail["Buyer days (from day after settlement)"]).toBe("76");
  });
});

describe("calculateBodyCorporateAdjustment — validation", () => {
  it("blocks on a missing levy amount", () => {
    expect(calculateBodyCorporateAdjustment(readyInput({ levyAmountCents: null }), { settlementDate: "2026-08-15" }).tier).toBe("error");
  });

  it("is pending when the notice hasn't been received", () => {
    const result = calculateBodyCorporateAdjustment(readyInput({ noticeNotYetReceived: true }), {
      settlementDate: "2026-08-15",
    });
    expect(result.pending).toBe(true);
  });
});
