import type { Metadata } from "next";
import { PexaWorkbench } from "@/components/pexa/pexa-workbench";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "PEXA Simulator",
};

export default function PexaSimulatorPage() {
  return (
    <div className="grid gap-4">
      <PageHeader
        title="PEXA Simulator"
        description="A safe replica of the electronic settlement platform. Practise workspaces, participants, documents and the Financial Settlement Schedule — no funds move and nothing is lodged."
      />
      <PexaWorkbench />
    </div>
  );
}
