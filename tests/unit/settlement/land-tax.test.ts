/**
 * Land Tax adjustment engine — the one category that MUST NOT auto-calculate.
 * These tests exist primarily to guarantee that guarantee holds.
 */

import { describe, expect, it } from "vitest";
import { calculateLandTaxAdjustment, newLandTaxAdjustmentInput, type LandTaxAdjustmentInput } from "@/lib/settlement/adjustments/landTax";
import { dollarsToCents } from "@/lib/settlement/money";

function baseInput(patch: Partial<LandTaxAdjustmentInput> = {}): LandTaxAdjustmentInput {
  return { ...newLandTaxAdjustmentInput("lt1"), ...patch };
}

describe("calculateLandTaxAdjustment — never auto-calculates", () => {
  it("produces no ledger entry when adjustmentApplicable is not set", () => {
    const result = calculateLandTaxAdjustment(baseInput());
    expect(result.automatic).toBeNull();
    expect(result.effective).toBeNull();
  });

  it("produces no ledger entry when adjustmentApplicable is explicitly false", () => {
    const result = calculateLandTaxAdjustment(baseInput({ adjustmentApplicable: false }));
    expect(result.automatic).toBeNull();
    expect(result.effective).toBeNull();
  });

  it("produces no ledger entry even with an amount present, unless applicable is true", () => {
    const result = calculateLandTaxAdjustment(
      baseInput({ landTaxAmountCents: dollarsToCents(5000), manualAdjustmentCents: dollarsToCents(1000) }),
    );
    expect(result.automatic).toBeNull();
  });

  it("only produces a ledger entry when applicable=true AND a manual amount AND a debit party are supplied", () => {
    const result = calculateLandTaxAdjustment(
      baseInput({ adjustmentApplicable: true, manualAdjustmentCents: dollarsToCents(500), debitParty: "BUYER" }),
    );
    expect(result.automatic).not.toBeNull();
    expect(result.effective!.ledgerEntries[0].amountCents).toBe(dollarsToCents(500));
  });

  it("blocks with an error when applicable=true but no manual amount is given", () => {
    const result = calculateLandTaxAdjustment(baseInput({ adjustmentApplicable: true, debitParty: "BUYER" }));
    expect(result.tier).toBe("error");
  });

  it("blocks with an error when applicable=true but no party is specified", () => {
    const result = calculateLandTaxAdjustment(baseInput({ adjustmentApplicable: true, manualAdjustmentCents: dollarsToCents(500) }));
    expect(result.tier).toBe("error");
  });
});

describe("calculateLandTaxAdjustment — mandatory warning", () => {
  it("always carries the confirm-against-the-contract warning, applicable or not", () => {
    const notApplicable = calculateLandTaxAdjustment(baseInput());
    const applicable = calculateLandTaxAdjustment(
      baseInput({ adjustmentApplicable: true, manualAdjustmentCents: dollarsToCents(500), debitParty: "SELLER" }),
    );
    expect(notApplicable.messages.some((m) => /confirmed against the contract/i.test(m.text))).toBe(true);
    expect(applicable.messages.some((m) => /confirmed against the contract/i.test(m.text))).toBe(true);
  });
});

describe("calculateLandTaxAdjustment — notes passthrough", () => {
  it("carries financial year and contract-treatment notes into the trail untouched", () => {
    const result = calculateLandTaxAdjustment(
      baseInput({
        adjustmentApplicable: true,
        manualAdjustmentCents: dollarsToCents(500),
        debitParty: "BUYER",
        financialYear: "2026-27",
        contractTreatmentNotes: "Special condition 12 requires adjustment.",
      }),
    );
    const trail = Object.fromEntries(result.automatic!.trail.map((t) => [t.label, t.value]));
    expect(trail["Financial year"]).toBe("2026-27");
    expect(trail["Contract treatment"]).toBe("Special condition 12 requires adjustment.");
  });
});
