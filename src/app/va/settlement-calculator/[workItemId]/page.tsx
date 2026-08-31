import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadOrCreateSettlementDraft } from "@/lib/actions/settlement";
import { MatterSettlementCalculator } from "@/components/settlement/matter-settlement-calculator";
import type { SettlementHistoryEntry } from "@/components/settlement/settlement-history-panel";
import type { SettlementState } from "@/lib/settlement/state";

export const metadata = { title: "Settlement Calculator" };

export default async function VaMatterSettlementCalculatorPage({
  params,
}: {
  params: Promise<{ workItemId: string }>;
}) {
  const { workItemId } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
  // A VA only ever sees their own matter; Admin/Trainer can review (and act
  // on) any VA's, the same oversight carve-out as everywhere else in Work
  // Status — enforced again here, not just by proxy.ts routing.
  if (!item || item.deletedAt) notFound();
  if (role === "VA" && item.userId !== userId) notFound();

  const { draft, history } = await loadOrCreateSettlementDraft(workItemId);

  const historyEntries: SettlementHistoryEntry[] = history.map((h) => ({
    id: h.id,
    version: h.version,
    status: h.status,
    settlementAmountCents: h.settlementAmountCents,
    createdAt: h.createdAt,
    createdByName: h.createdBy?.name ?? "—",
    finalisedAt: h.finalisedAt,
    finalisedByName: h.finalisedBy?.name ?? null,
  }));

  return (
    <MatterSettlementCalculator
      workItemId={workItemId}
      initialState={draft.state as unknown as SettlementState}
      matterTitle={item.title}
      matterReference={item.matterReference}
      jurisdiction={item.jurisdiction}
      matterType={item.matterType}
      canFinalise
      history={historyEntries}
    />
  );
}
