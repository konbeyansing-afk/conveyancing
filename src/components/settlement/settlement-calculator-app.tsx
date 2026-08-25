"use client";

import { Calculator } from "lucide-react";
import { AdjustmentList } from "./adjustment-list";
import { CalculationSummary } from "./calculation-summary";
import { MatterActionsBar } from "./matter-actions-bar";
import { MatterSetupSection } from "./matter-setup-section";
import { ScopeNoticeCard } from "./scope-notice-card";
import { SettlementCostsSection } from "./settlement-costs-section";
import { SettlementStatementView } from "./settlement-statement";
import { ValidationWarningsPanel } from "./validation-warnings-panel";
import { SettlementProvider } from "@/lib/settlement/store";

function SettlementCalculatorScreen() {
  return (
    <div className="grid gap-4 print:gap-2">
      <div className="print:hidden">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Calculator className="size-6 text-primary" />
          Settlement Calculator
        </h1>
        <p className="text-muted-foreground">
          Queensland conveyancing settlement calculator — matter details, adjustments, costs and the buyer/seller
          settlement statement, with the working shown so every figure can be checked back to its inputs. Review
          every figure against the contract, current searches and certificates before relying on it.
        </p>
      </div>

      <MatterActionsBar />
      <MatterSetupSection />

      <section className="grid gap-2 print:hidden">
        <h2 className="text-lg font-semibold">Adjustments</h2>
        <AdjustmentList />
      </section>

      <section className="grid gap-2 print:hidden">
        <h2 className="text-lg font-semibold">Settlement Costs</h2>
        <SettlementCostsSection />
      </section>

      <hr className="print:hidden" />

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold print:hidden">Calculation Summary</h2>
        <CalculationSummary />
      </section>

      <hr className="print:hidden" />

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold print:hidden">Settlement Statement</h2>
        <SettlementStatementView />
      </section>

      <section className="grid gap-2 print:hidden">
        <h2 className="text-lg font-semibold">Validation &amp; Warnings</h2>
        <ValidationWarningsPanel />
      </section>

      <ScopeNoticeCard />
    </div>
  );
}

export function SettlementCalculatorApp() {
  return (
    <SettlementProvider>
      <SettlementCalculatorScreen />
    </SettlementProvider>
  );
}
