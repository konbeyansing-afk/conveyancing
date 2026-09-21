import type { Metadata } from "next";
import { SimWorkbench } from "@/components/simulator/sim-workbench";
import { PageHeader } from "@/components/page-header";
import { TrainingModeBanner } from "@/components/simulator/training-mode-banner";

export const metadata: Metadata = {
  title: "Practice System Simulator",
};

export default function PracticeSystemPage() {
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Practice System Simulator"
        description="A safe replica of the firm's practice management system. Work through the guided tasks on the right — nothing you do here touches a live matter."
      />
      <TrainingModeBanner system="the firm's practice management system" />
      <SimWorkbench />
    </div>
  );
}
