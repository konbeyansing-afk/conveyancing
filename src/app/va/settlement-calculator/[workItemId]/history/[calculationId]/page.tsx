import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { MatterSettlementHeader } from "@/components/settlement/matter-settlement-header";
import { ReadOnlySettlementView } from "@/components/settlement/read-only-settlement-view";
import { formatAUD } from "@/lib/settlement/money";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { SettlementState } from "@/lib/settlement/state";

export const metadata = { title: "Settlement Calculation — History" };

export default async function VaSettlementHistoryPage({
  params,
}: {
  params: Promise<{ workItemId: string; calculationId: string }>;
}) {
  const { workItemId, calculationId } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
  if (!item || item.deletedAt) notFound();
  if (role === "VA" && item.userId !== userId) notFound();

  const calc = await prisma.settlementCalculation.findUnique({
    where: { id: calculationId },
    include: { finalisedBy: { select: { name: true } } },
  });
  if (!calc || calc.workItemId !== workItemId) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Settlement Calculator", href: "/va/settlement-calculator" },
          { label: item.title, href: `/va/settlement-calculator/${workItemId}` },
          { label: `Version ${calc.version}` },
        ]}
        title={`Version ${calc.version}${calc.status === "FINALISED" ? " — Finalised" : " — Draft"}`}
        description={
          calc.status === "FINALISED" && calc.finalisedAt
            ? `Finalised ${formatRelativeTime(calc.finalisedAt)} by ${calc.finalisedBy?.name ?? "—"}${calc.settlementAmountCents !== null ? ` · ${formatAUD(calc.settlementAmountCents)}` : ""}`
            : undefined
        }
      />

      <MatterSettlementHeader
        matterTitle={item.title}
        matterReference={item.matterReference}
        jurisdiction={calc.jurisdiction}
        matterType={item.matterType}
      />

      <ReadOnlySettlementView state={calc.state as unknown as SettlementState} />
    </div>
  );
}
