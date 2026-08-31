import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JurisdictionBadge } from "@/components/work-status/jurisdiction-badge";
import { MATTER_TYPE_LABELS } from "@/lib/matter-stage";
import { ClipboardList, Calculator } from "lucide-react";

export const metadata = { title: "Settlement Calculator" };

/**
 * Tools entry point (spec section 1): open the calculator against one of
 * your own matters (auto-associates the calculation with it), or use the
 * practice tool for a calculation not tied to any real matter.
 */
export default async function VaSettlementCalculatorPage() {
  const session = await auth();
  const userId = session!.user.id;

  const matters = await prisma.workItem.findMany({
    where: { userId, deletedAt: null, status: { not: "COMPLETED" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, matterReference: true, jurisdiction: true, matterType: true, matterStage: true },
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settlement Calculator"
        description="Open the calculator against one of your own matters, or use the practice tool for a calculation not tied to a real matter."
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Open Against a Matter</h2>
        {matters.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No open matters"
            description="Start a matter from Work Status first, then come back here to calculate its settlement."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {matters.map((m) => (
              <Link key={m.id} href={`/va/settlement-calculator/${m.id}`}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="truncate text-sm">{m.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <JurisdictionBadge jurisdiction={m.jurisdiction} />
                      {m.matterType && <Badge variant="secondary">{MATTER_TYPE_LABELS[m.matterType]}</Badge>}
                    </div>
                    {m.matterReference && <p className="text-xs text-muted-foreground">Matter #{m.matterReference}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Practice Calculation</h2>
        <Link href="/app/tools/settlement-calculator">
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-3 py-4">
              <Calculator className="size-6 text-primary" />
              <div>
                <p className="font-medium">Open the practice calculator</p>
                <p className="text-sm text-muted-foreground">
                  Not linked to any matter — for trying out a calculation, saved locally in your browser only.
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
