import { Lightbulb, TriangleAlert } from "lucide-react";

/**
 * Training Mode content for the water adjustment (spec section 20/27) —
 * explains the mechanics for a trainee, never asserts a rule not already
 * encoded in the engine itself.
 */
export function WaterTrainingNotes() {
  return (
    <div className="grid gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
      <p className="flex items-start gap-1.5 font-medium text-foreground">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Why does the calculator need the billing period?
      </p>
      <p className="pl-5 text-muted-foreground">
        Because the settlement adjustment depends on the portion of the charge attributable to each party — the
        seller for the days up to and including settlement, the buyer from the day after. Getting the actual
        period wrong (not the calendar year, the period the notice itself covers) gets the whole adjustment wrong.
      </p>
      <p className="pl-5 text-muted-foreground">
        A usage charge is different: it&apos;s based on real consumption, not a fixed period amount, so it&apos;s
        estimated from an actual previous and special meter reading rather than day-prorated at all. Arrears and
        credits are different again — they&apos;re a pre-existing balance from before this billing period, so
        they&apos;re never prorated either.
      </p>
      <p className="flex items-start gap-1.5 font-medium text-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
        Common mistakes
      </p>
      <ul className="grid gap-1 pl-8 text-muted-foreground [list-style:disc]">
        <li>Using the wrong billing period (e.g. assuming a full year when the notice covers a quarter)</li>
        <li>Using the wrong settlement date</li>
        <li>Prorating the whole bill without checking which components are usage-based vs fixed</li>
        <li>Forgetting a credit, or entering it as a positive charge</li>
        <li>Including old arrears in the current-period adjustment</li>
        <li>Rounding the daily rate too early, before splitting seller/buyer shares</li>
        <li>Assuming every billing period is 365 days — use the actual dates on the notice</li>
      </ul>
      <p className="text-muted-foreground">What to check: compare every figure against the actual water bill/notice and the contract&apos;s special conditions.</p>
    </div>
  );
}
