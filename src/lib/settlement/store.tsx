"use client";

/**
 * Client-side state for the settlement calculator. A single working copy,
 * persisted to localStorage (not sessionStorage — this is a real working
 * document a colleague may return to after closing the tab, not a training
 * sandbox), autosaved on every change.
 */

import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
} from "react";
import { usePersistentReducer } from "@/lib/training/persist";
import { newSettlementCosts } from "./costs";
import type { BodyCorporateAdjustmentInput } from "./adjustments/bodyCorporate";
import { newBodyCorporateAdjustmentInput } from "./adjustments/bodyCorporate";
import type { CustomAdjustmentInput } from "./adjustments/custom";
import { newCustomAdjustmentInput } from "./adjustments/custom";
import type { LandTaxAdjustmentInput } from "./adjustments/landTax";
import { newLandTaxAdjustmentInput } from "./adjustments/landTax";
import type { RatesAdjustmentInput } from "./adjustments/rates";
import { newRatesAdjustmentInput } from "./adjustments/rates";
import type { RentAdjustmentInput } from "./adjustments/rent";
import { newRentAdjustmentInput } from "./adjustments/rent";
import type { WaterAdjustmentInput } from "./adjustments/water";
import { newWaterAdjustmentInput } from "./adjustments/water";
import type { AdjustmentCategory, MatterDetails, SettlementCosts } from "./types";

export type SettlementAdjustmentItem =
  | { id: string; category: "RATES"; input: RatesAdjustmentInput }
  | { id: string; category: "WATER"; input: WaterAdjustmentInput }
  | { id: string; category: "BODY_CORPORATE"; input: BodyCorporateAdjustmentInput }
  | { id: string; category: "RENT"; input: RentAdjustmentInput }
  | { id: string; category: "LAND_TAX"; input: LandTaxAdjustmentInput }
  | { id: string; category: "CUSTOM"; input: CustomAdjustmentInput };

export interface SettlementState {
  matter: MatterDetails;
  adjustments: SettlementAdjustmentItem[];
  costs: SettlementCosts;
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now()}`;
}

export function newMatterDetails(): MatterDetails {
  return {
    transactionType: "PURCHASE",
    propertyAddress: "",
    contractDate: null,
    settlementDate: null,
    contractPriceCents: null,
    depositPaidCents: null,
    loanProceedsCents: null,
    clientFundsCents: null,
  };
}

export function newSettlementState(): SettlementState {
  return { matter: newMatterDetails(), adjustments: [], costs: newSettlementCosts() };
}

function newAdjustmentItem(category: AdjustmentCategory): SettlementAdjustmentItem {
  const id = nextId("adj");
  switch (category) {
    case "RATES":
      return { id, category, input: newRatesAdjustmentInput(id) };
    case "WATER":
      return { id, category, input: newWaterAdjustmentInput(id) };
    case "BODY_CORPORATE":
      return { id, category, input: newBodyCorporateAdjustmentInput(id) };
    case "RENT":
      return { id, category, input: newRentAdjustmentInput(id) };
    case "LAND_TAX":
      return { id, category, input: newLandTaxAdjustmentInput(id) };
    case "CUSTOM":
      return { id, category, input: newCustomAdjustmentInput(id) };
  }
}

export type SettlementAction =
  | { type: "SET_MATTER_FIELD"; patch: Partial<MatterDetails> }
  | { type: "ADD_ADJUSTMENT"; category: AdjustmentCategory }
  | { type: "UPDATE_ADJUSTMENT"; id: string; patch: Record<string, unknown> }
  | { type: "REMOVE_ADJUSTMENT"; id: string }
  | { type: "SET_BUYER_COST"; patch: Record<string, unknown> }
  | { type: "SET_SELLER_COST"; patch: Record<string, unknown> }
  | { type: "NEW_CALCULATION" }
  | { type: "DUPLICATE_MATTER" };

export function settlementReducer(state: SettlementState, action: SettlementAction): SettlementState {
  switch (action.type) {
    case "SET_MATTER_FIELD":
      return { ...state, matter: { ...state.matter, ...action.patch } };

    case "ADD_ADJUSTMENT":
      return { ...state, adjustments: [...state.adjustments, newAdjustmentItem(action.category)] };

    case "UPDATE_ADJUSTMENT":
      return {
        ...state,
        adjustments: state.adjustments.map((item) =>
          item.id === action.id
            ? ({ ...item, input: { ...item.input, ...action.patch } } as SettlementAdjustmentItem)
            : item,
        ),
      };

    case "REMOVE_ADJUSTMENT":
      return { ...state, adjustments: state.adjustments.filter((item) => item.id !== action.id) };

    case "SET_BUYER_COST":
      return { ...state, costs: { ...state.costs, buyer: { ...state.costs.buyer, ...action.patch } } };

    case "SET_SELLER_COST":
      return { ...state, costs: { ...state.costs, seller: { ...state.costs.seller, ...action.patch } } };

    case "NEW_CALCULATION":
      return newSettlementState();

    case "DUPLICATE_MATTER":
      return {
        matter: {
          ...newMatterDetails(),
          transactionType: state.matter.transactionType,
          propertyAddress: state.matter.propertyAddress,
          contractPriceCents: state.matter.contractPriceCents,
        },
        adjustments: [],
        costs: newSettlementCosts(),
      };

    default:
      return state;
  }
}

export const SETTLEMENT_STORAGE_KEY = "conveyancing-academy:settlement-calculator";

type SettlementContextValue = { state: SettlementState; dispatch: Dispatch<SettlementAction> };

const SettlementContext = createContext<SettlementContextValue | null>(null);

export function SettlementProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = usePersistentReducer(
    SETTLEMENT_STORAGE_KEY,
    settlementReducer,
    newSettlementState,
    { storage: "local" },
  );
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <SettlementContext.Provider value={value}>{children}</SettlementContext.Provider>;
}

export function useSettlement(): SettlementContextValue {
  const ctx = useContext(SettlementContext);
  if (!ctx) throw new Error("useSettlement must be used inside <SettlementProvider>");
  return ctx;
}
