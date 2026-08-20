import type { Metadata } from "next";
import { ActionstepWorkbench } from "@/components/actionstep/actionstep-workbench";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Actionstep Simulator",
};

export default function ActionstepSimulatorPage() {
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Actionstep Simulator"
        description="A safe replica of a workflow-driven practice management system. Matters move through workflow steps, and a step won't release a matter until its required participants and data fields are filled in."
      />
      <ActionstepWorkbench />
    </div>
  );
}
