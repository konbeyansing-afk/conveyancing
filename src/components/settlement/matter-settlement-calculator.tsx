"use client";

import { useState } from "react";
import { Calculator, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdjustmentList } from "./adjustment-list";
import { CalculationStatusBadge } from "./calculation-status-badge";
import { CalculationSummary } from "./calculation-summary";
import { MatterSettlementActionsBar } from "./matter-settlement-actions-bar";
import { MatterSettlementHeader } from "./matter-settlement-header";
import { MatterSettlementProvider } from "./matter-settlement-store";
import { MatterSetupSection } from "./matter-setup-section";
import { ScopeNoticeCard } from "./scope-notice-card";
import { SettlementCostsSection } from "./settlement-costs-section";
import { SettlementHistoryPanel, type SettlementHistoryEntry } from "./settlement-history-panel";
import { SettlementStatementView } from "./settlement-statement";
import { ValidationWarningsPanel } from "./validation-warnings-panel";
import type { SettlementState } from "@/lib/settlement/state";
import type { Jurisdiction, MatterType } from "@prisma/client";

function MatterSettlementScreen({
  workItemId,
  matterTitle,
  matterReference,
  jurisdiction,
  matterType,
  canFinalise,
  history,
}: {
  workItemId: string;
  matterTitle: string;
  matterReference: string | null;
  jurisdiction: Jurisdiction;
  matterType: MatterType | null;
  canFinalise: boolean;
  history: SettlementHistoryEntry[];
}) {
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
            Matter details, adjustments, costs and the buyer/seller settlement statement, with the working shown so
            every figure can be checked back to its inputs. Review every figure against the contract, current
            searches and certificates before relying on it.
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

      <MatterSettlementHeader
        matterTitle={matterTitle}
        matterReference={matterReference}
        jurisdiction={jurisdiction}
        matterType={matterType}
      />

      <div className="print:hidden">
        <CalculationStatusBadge />
      </div>

      <MatterSettlementActionsBar canFinalise={canFinalise} />

      <MatterSetupSection />

      <section className="grid gap-2 print:hidden">
        <h2 className="text-lg font-semibold">Settlement Adjustments</h2>
        <AdjustmentList jurisdiction={jurisdiction} trainingMode={trainingMode} />
      </section>

      <section className="grid gap-2 print:hidden">
        <h2 className="text-lg font-semibold">Fees &amp; Disbursements</h2>
        <SettlementCostsSection />
      </section>

      <hr className="print:hidden" />

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold print:hidden">Settlement Summary</h2>
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

      <SettlementHistoryPanel workItemId={workItemId} entries={history} />

      <ScopeNoticeCard />
    </div>
  );
}

export function MatterSettlementCalculator({
  workItemId,
  initialState,
  matterTitle,
  matterReference,
  jurisdiction,
  matterType,
  canFinalise,
  history,
}: {
  workItemId: string;
  initialState: SettlementState;
  matterTitle: string;
  matterReference: string | null;
  jurisdiction: Jurisdiction;
  matterType: MatterType | null;
  canFinalise: boolean;
  history: SettlementHistoryEntry[];
}) {
  return (
    <MatterSettlementProvider workItemId={workItemId} initialState={initialState}>
      <MatterSettlementScreen
        workItemId={workItemId}
        matterTitle={matterTitle}
        matterReference={matterReference}
        jurisdiction={jurisdiction}
        matterType={matterType}
        canFinalise={canFinalise}
        history={history}
      />
    </MatterSettlementProvider>
  );
}
