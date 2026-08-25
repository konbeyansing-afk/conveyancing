"use client";

/**
 * Shared money input, used everywhere a dollar amount is entered. Shows a
 * plain editable number while focused (so the cursor never has to dodge a
 * thousands separator mid-edit) and reformats to "1,234.50" with a static
 * `$` prefix on blur. Calls back on every valid keystroke so the live
 * calculation summary stays reactive, matching how the rest of this app's
 * forms behave.
 */

import { useState } from "react";
import { centsToDollars, formatDollarsPlain, parseDollarStringToCents, type Cents } from "@/lib/settlement/money";
import { cn } from "@/lib/utils";

export function CurrencyInput({
  valueCents,
  onChangeCents,
  placeholder = "0.00",
  disabled,
  className,
  id,
}: {
  valueCents: Cents | null;
  onChangeCents: (cents: Cents | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  // Only ever read while focused — the unfocused display always renders
  // straight from `valueCents` below, so there's nothing to keep in sync.
  const [draft, setDraft] = useState("");

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={focused ? draft : formatDollarsPlain(valueCents)}
        onFocus={() => {
          setFocused(true);
          setDraft(valueCents !== null ? centsToDollars(valueCents).toString() : "");
        }}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const cents = parseDollarStringToCents(next);
          if (next.trim() === "") {
            onChangeCents(null);
          } else if (cents !== null) {
            onChangeCents(cents);
          }
          // Invalid mid-typing input (e.g. "12.") keeps the last valid value
          // in parent state and just lets the box show what was typed.
        }}
        onBlur={() => {
          setFocused(false);
        }}
        className={cn(
          "h-8 w-full rounded-md border border-input bg-transparent py-1 pr-2.5 pl-6 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
    </div>
  );
}
