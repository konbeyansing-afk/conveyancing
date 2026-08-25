import type { Metadata } from "next";
import { SettlementCalculatorApp } from "@/components/settlement/settlement-calculator-app";

export const metadata: Metadata = {
  title: "Settlement Calculator",
};

export default function SettlementCalculatorPage() {
  return <SettlementCalculatorApp />;
}
