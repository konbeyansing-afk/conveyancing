import type { Metadata } from "next";
import { SettlementCalculatorApp } from "@/components/settlement/settlement-calculator-app";

export const metadata: Metadata = {
  title: "Settlement Calculator",
};

/**
 * The same practice calculator as /app/tools/settlement-calculator — not
 * linked to any matter, saved locally in the browser only — but hosted
 * under the VA layout so a VA trying it from their own Settlement
 * Calculator page never leaves their own VA workspace (sidebar, "VA
 * workspace" label) for the Trainee section. Deliberately the same
 * component and the same localStorage draft either way: this is one
 * practice tool with two entry points, not two separate tools.
 */
export default function VaPracticeSettlementCalculatorPage() {
  return <SettlementCalculatorApp />;
}
