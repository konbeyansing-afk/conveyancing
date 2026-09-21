"use client";

import { useState } from "react";
import { Calculator, GraduationCap } from "lucide-react";
import { AdjustmentList } from "./adjustment-list";
import { CalculationSummary } from "./calculation-summary";
import { MatterActionsBar } from "./matter-actions-bar";
import { MatterSetupSection } from "./matter-setup-section";
import { ScopeNoticeCard } from "./scope-notice-card";
import { SettlementCostsSection } from "./settlement-costs-section";
import { SettlementStatementView } from "./settlement-statement";
import { ValidationWarningsPanel } from "./validation-warnings-panel";
import { SettlementProvider } from "@/lib/settlement/store";
import { Button } from "@/components/ui/button";

function SectionHeading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`flex items-center gap-2 text-lg font-semibold tracking-tight ${className}`}>
      <span aria-hidden className="h-5 w-1 rounded-full bg-primary" />
      {children}
    </h2>
  );
}

function SettlementCalculatorScreen() {
  const [trainingMode, setTrainingMode] = useState(false);

  return (
    <div className="grid gap-4 print:gap-2">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
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
        <Button
          type="button"
          variant={trainingMode ? "default" : "outline"}
          size="sm"
          onClick={() => setTrainingMode((v) => !v)}
        >
          <GraduationCap className="size-3.5" />
          Training Mode {trainingMode ? "On" : "Off"}
        </Button>
      </div>

      <MatterActionsBar />
      <MatterSetupSection />

      <section className="grid gap-2 print:hidden">
        <SectionHeading>Adjustments</SectionHeading>
        <AdjustmentList trainingMode={trainingMode} />
      </section>

      <section className="grid gap-2 print:hidden">
        <SectionHeading>Settlement Costs</SectionHeading>
        <SettlementCostsSection />
      </section>

      <hr className="print:hidden" />

      <section className="grid gap-2">
        <SectionHeading className="print:hidden">Calculation Summary</SectionHeading>
        <CalculationSummary />
      </section>

      <hr className="print:hidden" />

      <section className="grid gap-2">
        <SectionHeading className="print:hidden">Settlement Statement</SectionHeading>
        <SettlementStatementView />
      </section>

      <section className="grid gap-2 print:hidden">
        <SectionHeading>Validation &amp; Warnings</SectionHeading>
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
