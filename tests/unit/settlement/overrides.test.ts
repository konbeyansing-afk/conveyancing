/**
 * Shared manual-override resolution (src/lib/settlement/override.ts),
 * tested directly rather than through any one category, since every
 * auto-calculating category delegates to the same function.
 */

import { describe, expect, it } from "vitest";
import { finalizeAdjustmentResult } from "@/lib/settlement/override";
import { dollarsToCents } from "@/lib/settlement/money";
import type { CalculationTrailStep, LedgerEntry } from "@/lib/settlement/types";

const automatic = {
  ledgerEntries: [
    { party: "BUYER", side: "DEBIT", amountCents: dollarsToCents(100), description: "auto", sourceAdjustmentId: "x", category: "RATES" },
    { party: "SELLER", side: "CREDIT", amountCents: dollarsToCents(100), description: "auto", sourceAdjustmentId: "x", category: "RATES" },
  ] as LedgerEntry[],
  trail: [{ label: "l", value: "v" }] as CalculationTrailStep[],
};

describe("finalizeAdjustmentResult — no override", () => {
  it("uses the automatic result as effective", () => {
    const result = finalizeAdjustmentResult({
      id: "x",
      category: "RATES",
      override: { enabled: false, amountCents: null, reason: "" },
      overrideDescription: "override",
      overrideDebitParty: "BUYER",
      messages: [],
      automatic,
    });
    expect(result.effective!.source).toBe("automatic");
    expect(result.effective!.ledgerEntries).toBe(automatic.ledgerEntries);
    expect(result.override).toBeNull();
  });
});

describe("finalizeAdjustmentResult — override enabled", () => {
  it("requires an amount", () => {
    const result = finalizeAdjustmentResult({
      id: "x",
      category: "RATES",
      override: { enabled: true, amountCents: null, reason: "Because." },
      overrideDescription: "override",
      overrideDebitParty: "BUYER",
      messages: [],
      automatic,
    });
    expect(result.tier).toBe("error");
    expect(result.messages.some((m) => /enter the manual override amount/i.test(m.text))).toBe(true);
  });

  it("requires a reason", () => {
    const result = finalizeAdjustmentResult({
      id: "x",
      category: "RATES",
      override: { enabled: true, amountCents: dollarsToCents(50), reason: "" },
      overrideDescription: "override",
      overrideDebitParty: "BUYER",
      messages: [],
      automatic,
    });
    expect(result.tier).toBe("error");
    expect(result.messages.some((m) => /reason is required/i.test(m.text))).toBe(true);
  });

  it("with both present, effective uses the override amount while automatic stays untouched", () => {
    const result = finalizeAdjustmentResult({
      id: "x",
      category: "RATES",
      override: { enabled: true, amountCents: dollarsToCents(75), reason: "Contract variation." },
      overrideDescription: "override",
      overrideDebitParty: "SELLER",
      messages: [],
      automatic,
    });
    expect(result.effective!.source).toBe("override");
    expect(result.effective!.ledgerEntries[0].amountCents).toBe(dollarsToCents(75));
    expect(result.effective!.ledgerEntries.find((e) => e.party === "SELLER")?.side).toBe("DEBIT");
    // The automatic calculation is still fully present, untouched, for the trail comparison.
    expect(result.automatic).toBe(automatic);
    expect(result.automatic!.ledgerEntries[0].amountCents).toBe(dollarsToCents(100));
  });

  it("works even when there is no automatic result at all (e.g. blocked category)", () => {
    const result = finalizeAdjustmentResult({
      id: "x",
      category: "RATES",
      override: { enabled: true, amountCents: dollarsToCents(75), reason: "Manual figure, notice unavailable." },
      overrideDescription: "override",
      overrideDebitParty: "BUYER",
      messages: [{ tier: "error", text: "Missing notice." }],
      automatic: null,
    });
    // The override still applies even though there's no automatic figure to fall back to for comparison.
    expect(result.effective!.source).toBe("override");
    expect(result.automatic).toBeNull();
  });

  it("preserves pre-existing messages alongside the override notice", () => {
    const result = finalizeAdjustmentResult({
      id: "x",
      category: "RATES",
      override: { enabled: true, amountCents: dollarsToCents(75), reason: "ok" },
      overrideDescription: "override",
      overrideDebitParty: "BUYER",
      messages: [{ tier: "warning", text: "Pre-existing warning." }],
      automatic,
    });
    expect(result.messages.some((m) => m.text === "Pre-existing warning.")).toBe(true);
    expect(result.messages.some((m) => /manual override entered/i.test(m.text))).toBe(true);
  });
});
