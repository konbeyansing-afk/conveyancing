"use client";

import { useState } from "react";
import { CircleAlert, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const FLAGS = [
  { key: "newResidential", label: "New residential premises" },
  { key: "commercial", label: "Commercial property" },
  { key: "gstRegisteredVendor", label: "GST-registered vendor" },
  { key: "marginScheme", label: "Margin scheme applies" },
] as const;

export function ScopeNoticeCard() {
  const [flags, setFlags] = useState<Record<(typeof FLAGS)[number]["key"], boolean>>({
    newResidential: false,
    commercial: false,
    gstRegisteredVendor: false,
    marginScheme: false,
  });
  const anyFlag = Object.values(flags).some(Boolean);

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CircleAlert className="size-4 text-muted-foreground" />
          Not calculated here
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">GST</strong> is out of scope for this calculator — it assumes a
          standard residential resale where no GST applies to the sale itself.
        </p>
        <div className="grid gap-2 border-t pt-3">
          <p className="text-sm font-medium">Does this matter involve any of the following?</p>
          {FLAGS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={flags[f.key]}
                onCheckedChange={(checked) => setFlags((prev) => ({ ...prev, [f.key]: checked === true }))}
              />
              {f.label}
            </label>
          ))}
        </div>
        {anyFlag && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>Stop — flag this file for your supervising solicitor/conveyancer. This calculator doesn&apos;t handle GST scenarios.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
