import { Badge } from "@/components/ui/badge";
import { JURISDICTION_LABELS } from "@/lib/matter-stage";
import type { Jurisdiction } from "@prisma/client";

/** Visible but deliberately quiet (spec: "should not overpower the matter information") — an outline badge, not the primary-filled treatment MatterStageBadge uses. */
export function JurisdictionBadge({ jurisdiction, className }: { jurisdiction: Jurisdiction; className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      {JURISDICTION_LABELS[jurisdiction]}
    </Badge>
  );
}
