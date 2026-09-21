import { FlaskConical } from "lucide-react";

/**
 * Makes it unmistakable that a simulator is a practice environment, so it can
 * never be confused with a real client system. Purely presentational.
 */
export function TrainingModeBanner({ system }: { system: string }) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-2.5 text-sm"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-warning-foreground uppercase">
        <FlaskConical aria-hidden className="size-3" />
        Training mode
      </span>
      <span className="text-foreground/80">
        You&apos;re in a practice copy of {system}. Nothing here touches a real matter, client or account.
      </span>
    </div>
  );
}
