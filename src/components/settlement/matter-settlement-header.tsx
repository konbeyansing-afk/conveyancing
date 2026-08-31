import { JURISDICTION_LABELS, MATTER_TYPE_LABELS } from "@/lib/matter-stage";
import { JurisdictionBadge } from "@/components/work-status/jurisdiction-badge";
import type { Jurisdiction, MatterType } from "@prisma/client";

/**
 * The "State / Matter / Type / Settlement Date" summary strip (spec
 * section 3) — read-only context about which matter this calculation
 * belongs to. Deliberately separate from the editable "Matter Details"
 * card below it (spec section 6: "clearly distinguish matter data from
 * calculator inputs") — this strip is the WorkItem's own data; the
 * calculator's own property address/price/dates fields are edited inside
 * the calculator itself and are not necessarily identical.
 */
export function MatterSettlementHeader({
  matterTitle,
  matterReference,
  jurisdiction,
  matterType,
}: {
  matterTitle: string;
  matterReference: string | null;
  jurisdiction: Jurisdiction;
  matterType: MatterType | null;
}) {
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm sm:grid-cols-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">State</p>
        <div className="mt-0.5">
          <JurisdictionBadge jurisdiction={jurisdiction} />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">Matter</p>
        <p className="truncate font-medium">{matterReference ?? matterTitle}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">Type</p>
        <p className="font-medium">{matterType ? MATTER_TYPE_LABELS[matterType] : "Not set"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">Jurisdiction</p>
        <p className="font-medium">{JURISDICTION_LABELS[jurisdiction]}</p>
      </div>
    </div>
  );
}
