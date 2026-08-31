/**
 * seedSettlementStateFromMatter — auto-populating a fresh calculation from
 * a matter (spec section 6). Deliberately minimal: only what a WorkItem
 * actually carries (matterType) drives a real field; everything else stays
 * blank and editable, never guessed.
 */

import { describe, expect, it } from "vitest";
import { seedSettlementStateFromMatter } from "@/lib/settlement/matter-seed";

describe("seedSettlementStateFromMatter", () => {
  it("maps matterType PURCHASE to transactionType PURCHASE", () => {
    const state = seedSettlementStateFromMatter({ title: "12 Example St", matterType: "PURCHASE" });
    expect(state.matter.transactionType).toBe("PURCHASE");
  });

  it("maps matterType SALE to transactionType SALE", () => {
    const state = seedSettlementStateFromMatter({ title: "12 Example St", matterType: "SALE" });
    expect(state.matter.transactionType).toBe("SALE");
  });

  it("defaults to PURCHASE when matterType is not set — never leaves it undefined", () => {
    const state = seedSettlementStateFromMatter({ title: "12 Example St", matterType: null });
    expect(state.matter.transactionType).toBe("PURCHASE");
  });

  it("seeds the property address from the matter's title, but nothing else — contract price and dates stay blank for the VA to enter", () => {
    const state = seedSettlementStateFromMatter({ title: "12 Example St, Suburb QLD 4000", matterType: "PURCHASE" });
    expect(state.matter.propertyAddress).toBe("12 Example St, Suburb QLD 4000");
    expect(state.matter.contractPriceCents).toBeNull();
    expect(state.matter.settlementDate).toBeNull();
    expect(state.matter.contractDate).toBeNull();
  });

  it("starts with no adjustments and no costs entered", () => {
    const state = seedSettlementStateFromMatter({ title: "12 Example St", matterType: "PURCHASE" });
    expect(state.adjustments).toEqual([]);
  });
});
