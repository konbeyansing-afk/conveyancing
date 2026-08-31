/**
 * computeSettlementSnapshot — the bridge between the (untouched) engine and
 * persistence: the estimated settlement amount to store, and Ready/
 * Incomplete/Error status (spec section 19). Exercises the status/amount
 * derivation logic itself; the underlying maths is already exhaustively
 * covered by tests/unit/settlement/*.
 */

import { describe, expect, it } from "vitest";
import { computeSettlementSnapshot } from "@/lib/settlement/snapshot";
import { newSettlementState } from "@/lib/settlement/state";
import { dollarsToCents } from "@/lib/settlement/money";
import type { SettlementState } from "@/lib/settlement/state";

function baseState(overrides: Partial<SettlementState["matter"]> = {}): SettlementState {
  const state = newSettlementState();
  return { ...state, matter: { ...state.matter, ...overrides } };
}

describe("computeSettlementSnapshot — status", () => {
  it("is INCOMPLETE with a blank matter — settlement date and contract price both missing", () => {
    const snapshot = computeSettlementSnapshot(baseState());
    expect(snapshot.status).toBe("INCOMPLETE");
    expect(snapshot.missingRequiredCount).toBe(2);
    expect(snapshot.settlementAmountCents).toBeNull();
  });

  it("is INCOMPLETE with only one of the two required fields missing", () => {
    const snapshot = computeSettlementSnapshot(
      baseState({ settlementDate: "2026-09-15", contractPriceCents: null }),
    );
    expect(snapshot.status).toBe("INCOMPLETE");
    expect(snapshot.missingRequiredCount).toBe(1);
  });

  it("is READY once both required fields are present and nothing errors", () => {
    const snapshot = computeSettlementSnapshot(
      baseState({ settlementDate: "2026-09-15", contractPriceCents: dollarsToCents(850000) }),
    );
    expect(snapshot.status).toBe("READY");
    expect(snapshot.missingRequiredCount).toBe(0);
    expect(snapshot.settlementAmountCents).not.toBeNull();
  });

  it("is ERROR when an adjustment has an error-tier message even though the top-level fields are filled", () => {
    const state = baseState({ settlementDate: "2026-09-15", contractPriceCents: dollarsToCents(850000) });
    // Land Tax always carries a mandatory warning and errors until the user
    // explicitly confirms applicability — the deliberately-manual-only
    // design (see adjustments/landTax.ts).
    const withLandTax: SettlementState = {
      ...state,
      adjustments: [
        {
          id: "lt-1",
          category: "LAND_TAX",
          input: {
            id: "lt-1",
            label: "",
            landTaxAmountCents: null,
            financialYear: "",
            contractTreatmentNotes: "",
            adjustmentApplicable: true,
            debitParty: null,
            manualAdjustmentCents: null,
            notes: "",
            override: { enabled: false, amountCents: null, reason: "" },
          },
        },
      ],
    };
    const snapshot = computeSettlementSnapshot(withLandTax);
    expect(snapshot.status).toBe("ERROR");
  });
});

describe("computeSettlementSnapshot — settlement amount perspective", () => {
  it("uses the buyer's balance required for a Purchase matter", () => {
    const state = baseState({
      transactionType: "PURCHASE",
      settlementDate: "2026-09-15",
      contractPriceCents: dollarsToCents(500000),
      depositPaidCents: dollarsToCents(50000),
    });
    const snapshot = computeSettlementSnapshot(state);
    // 500,000 - 50,000 deposit = 450,000 balance required.
    expect(snapshot.settlementAmountCents).toBe(dollarsToCents(450000));
  });

  it("uses the seller's net proceeds for a Sale matter", () => {
    const state = baseState({
      transactionType: "SALE",
      settlementDate: "2026-09-15",
      contractPriceCents: dollarsToCents(500000),
    });
    const snapshot = computeSettlementSnapshot(state);
    expect(snapshot.settlementAmountCents).toBe(dollarsToCents(500000));
  });
});
