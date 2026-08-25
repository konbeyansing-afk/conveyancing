/**
 * Custom Adjustment engine — fully manual passthrough, no formula.
 */

import { describe, expect, it } from "vitest";
import { calculateCustomAdjustment, newCustomAdjustmentInput, type CustomAdjustmentInput } from "@/lib/settlement/adjustments/custom";
import { dollarsToCents } from "@/lib/settlement/money";

function baseInput(patch: Partial<CustomAdjustmentInput> = {}): CustomAdjustmentInput {
  return {
    ...newCustomAdjustmentInput("c1"),
    description: "Agreed repair credit",
    amountCents: dollarsToCents(500),
    party: "BUYER",
    side: "CREDIT",
    reason: "Special condition 9 — pool fence repair credit.",
    ...patch,
  };
}

describe("calculateCustomAdjustment — passthrough", () => {
  it("produces exactly the entered amount with no calculation applied", () => {
    const result = calculateCustomAdjustment(baseInput());
    expect(result.tier).toBe("ok");
    expect(result.effective!.ledgerEntries[0].amountCents).toBe(dollarsToCents(500));
  });

  it.each([
    ["BUYER", "DEBIT"],
    ["BUYER", "CREDIT"],
    ["SELLER", "DEBIT"],
    ["SELLER", "CREDIT"],
  ] as const)("produces the exact party/side combination entered: %s %s", (party, side) => {
    const result = calculateCustomAdjustment(baseInput({ party, side }));
    const entries = result.effective!.ledgerEntries;
    expect(entries.find((e) => e.party === party)?.side).toBe(side);
    const otherParty = party === "BUYER" ? "SELLER" : "BUYER";
    const otherSide = side === "DEBIT" ? "CREDIT" : "DEBIT";
    expect(entries.find((e) => e.party === otherParty)?.side).toBe(otherSide);
  });
});

describe("calculateCustomAdjustment — validation", () => {
  it("blocks on a missing description", () => {
    expect(calculateCustomAdjustment(baseInput({ description: "" })).tier).toBe("error");
  });

  it("blocks on a missing amount", () => {
    expect(calculateCustomAdjustment(baseInput({ amountCents: null })).tier).toBe("error");
  });

  it("blocks on a missing party", () => {
    expect(calculateCustomAdjustment(baseInput({ party: null })).tier).toBe("error");
  });

  it("blocks on a missing reason", () => {
    expect(calculateCustomAdjustment(baseInput({ reason: "" })).tier).toBe("error");
  });
});

describe("calculateCustomAdjustment — trail", () => {
  it("includes the contract reference only when supplied", () => {
    const withRef = calculateCustomAdjustment(baseInput({ contractReference: "Special Condition 9" }));
    const withoutRef = calculateCustomAdjustment(baseInput({ contractReference: "" }));
    expect(withRef.automatic!.trail.some((t) => t.label === "Contract/reference")).toBe(true);
    expect(withoutRef.automatic!.trail.some((t) => t.label === "Contract/reference")).toBe(false);
  });
});
