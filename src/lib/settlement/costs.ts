/**
 * Settlement Costs — buyer costs and seller deductions, explicitly separate
 * from Adjustments (they're one-sided line items on the party's own
 * statement, not something split between both parties).
 */

import type { BuyerCosts, SellerCosts, SettlementCosts } from "./types";

export function newSettlementCosts(): SettlementCosts {
  return {
    buyer: {
      transferDutyCents: null,
      registrationFeeCents: null,
      lodgementFeeCents: null,
      pexaFeeCents: null,
      searchFeesCents: null,
      professionalFeesCents: null,
      otherCostsCents: null,
      otherCostsNote: "",
    },
    seller: {
      mortgagePayoutCents: null,
      commissionCents: null,
      pexaFeeCents: null,
      professionalFeesCents: null,
      otherCostsCents: null,
      otherCostsNote: "",
    },
  };
}

export const BUYER_COST_LABEL: Record<keyof Omit<BuyerCosts, "otherCostsNote">, string> = {
  transferDutyCents: "Transfer duty",
  registrationFeeCents: "Registration fee",
  lodgementFeeCents: "Lodgement fee",
  pexaFeeCents: "PEXA fee",
  searchFeesCents: "Search fees",
  professionalFeesCents: "Professional fees",
  otherCostsCents: "Other costs",
};

export const SELLER_COST_LABEL: Record<keyof Omit<SellerCosts, "otherCostsNote">, string> = {
  mortgagePayoutCents: "Mortgage discharge/payout",
  commissionCents: "Agent commission",
  pexaFeeCents: "PEXA fee",
  professionalFeesCents: "Professional fees",
  otherCostsCents: "Other costs",
};
