/**
 * Matter Stage & Jurisdiction — where a property transaction currently sits
 * in its conveyancing lifecycle, and which state's rules it follows. Both
 * are deliberately separate from Work Status (src/lib/work-status.ts),
 * which describes what the VA's own work is doing right now:
 *
 *   JURISDICTION = "Which state's rules apply?"   (Queensland)
 *   MATTER STAGE = "Where is the matter?"          (Pre-Settlement)
 *   WORK STATUS  = "What is the work doing?"         (In Progress)
 *   CURRENT TASK = "What is the VA doing?"            (Preparing settlement figures)
 *
 * Pure, no I/O, so it is cheap to test exhaustively and safe to import from
 * both server and client components. This file is the single source of
 * truth for jurisdiction/stage labels and for the per-jurisdiction workflow
 * — nowhere else should hardcode any of it.
 *
 * MATTER_WORKFLOWS is the "reusable configuration structure" a matter's
 * stage options are drawn from: Jurisdiction -> ordered MatterStage list.
 * Adding a future jurisdiction (VIC, SA, WA, ACT, TAS, NT) means adding one
 * entry here (plus a Prisma enum value) — no component needs to change.
 */

import type { Jurisdiction, MatterStage, MatterType } from "@prisma/client";

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  QLD: "Queensland",
  NSW: "New South Wales",
};

export const JURISDICTION_VALUES = Object.keys(JURISDICTION_LABELS) as Jurisdiction[];

export const MATTER_TYPE_LABELS: Record<MatterType, string> = {
  PURCHASE: "Purchase",
  SALE: "Sale",
};

export const MATTER_TYPE_VALUES = Object.keys(MATTER_TYPE_LABELS) as MatterType[];

/** Human-friendly labels for every stable stage identifier, regardless of which jurisdiction(s) use it. */
export const MATTER_STAGE_LABELS: Record<MatterStage, string> = {
  MATTER_OPENING: "Matter Opening",
  CONTRACT_REVIEW: "Contract Review",
  CONTRACT_SIGNED: "Contract Signed",
  CONTRACT_EXCHANGE: "Contract Exchange",
  COOLING_OFF: "Cooling-Off Period",
  FINANCE: "Finance",
  BUILDING_PEST: "Building & Pest",
  SEARCHES: "Searches",
  PRE_SETTLEMENT: "Pre-Settlement",
  SETTLEMENT_PREPARATION: "Settlement Preparation",
  SETTLEMENT_BOOKED: "Settlement Booked",
  SETTLEMENT: "Settlement",
  POST_SETTLEMENT: "Post-Settlement",
  LODGEMENT_REGISTRATION: "Lodgement & Registration",
  MATTER_FINALISATION: "Matter Finalisation",
  COMPLETED: "Completed",
};

/**
 * The Queensland and New South Wales conveyancing timelines, each its own
 * ordered sequence — NSW is not QLD with labels swapped: it reviews the
 * contract before exchange rather than after signing, orders Pre-Settlement
 * ahead of Searches/Finance, and has its own lodgement step.
 */
export const MATTER_WORKFLOWS: Record<Jurisdiction, MatterStage[]> = {
  QLD: [
    "MATTER_OPENING",
    "CONTRACT_REVIEW",
    "CONTRACT_SIGNED",
    "COOLING_OFF",
    "FINANCE",
    "BUILDING_PEST",
    "SEARCHES",
    "PRE_SETTLEMENT",
    "SETTLEMENT_BOOKED",
    "SETTLEMENT",
    "POST_SETTLEMENT",
    "MATTER_FINALISATION",
    "COMPLETED",
  ],
  NSW: [
    "MATTER_OPENING",
    "CONTRACT_REVIEW",
    "CONTRACT_EXCHANGE",
    "COOLING_OFF",
    "PRE_SETTLEMENT",
    "SEARCHES",
    "FINANCE",
    "SETTLEMENT_PREPARATION",
    "SETTLEMENT_BOOKED",
    "SETTLEMENT",
    "POST_SETTLEMENT",
    "LODGEMENT_REGISTRATION",
    "MATTER_FINALISATION",
    "COMPLETED",
  ],
};

/** Every matter starts here in both workflows — the safe default for rows/jurisdiction switches with no better answer. */
export const DEFAULT_MATTER_STAGE: MatterStage = "MATTER_OPENING";

export const MATTER_STAGE_VALUES = Object.keys(MATTER_STAGE_LABELS) as MatterStage[];

/** Membership in the global stage enum — not jurisdiction-scoped, see isStageValidForJurisdiction for that. */
export function isValidMatterStage(value: string): value is MatterStage {
  return (MATTER_STAGE_VALUES as string[]).includes(value);
}

export function matterWorkflow(jurisdiction: Jurisdiction): MatterStage[] {
  return MATTER_WORKFLOWS[jurisdiction];
}

/**
 * Whether `stage` is actually part of `jurisdiction`'s workflow (spec:
 * "A NSW matter should not accidentally receive a QLD-only workflow
 * stage"). Server actions must check this — the dropdown only offering
 * valid options is not enough on its own.
 */
export function isStageValidForJurisdiction(jurisdiction: Jurisdiction, stage: MatterStage): boolean {
  return MATTER_WORKFLOWS[jurisdiction].includes(stage);
}

/** Position of `stage` within `jurisdiction`'s workflow, or -1 if it does not belong to it. */
export function matterStageOrder(jurisdiction: Jurisdiction, stage: MatterStage): number {
  return MATTER_WORKFLOWS[jurisdiction].indexOf(stage);
}

export type StageVisualState = "completed" | "current" | "upcoming" | "blocked";

/**
 * Classifies `stage` relative to the matter's current stage, for the
 * conveyancing timeline: a stage strictly before the current one is ✓
 * completed, the current stage is ● current (or ⚠ blocked, if the VA's
 * work status is currently Blocked — blocking is a work-status concept, so
 * it only ever marks the *current* stage this way), everything after is ○
 * upcoming.
 */
export function stageVisualState(
  jurisdiction: Jurisdiction,
  stage: MatterStage,
  currentStage: MatterStage,
  isWorkBlocked = false,
): StageVisualState {
  if (stage === currentStage) return isWorkBlocked ? "blocked" : "current";
  const workflow = MATTER_WORKFLOWS[jurisdiction];
  const stageIndex = workflow.indexOf(stage);
  const currentIndex = workflow.indexOf(currentStage);
  return stageIndex < currentIndex ? "completed" : "upcoming";
}

/** The next stage after `currentStage` in `jurisdiction`'s workflow, or null once at the end. */
export function nextMatterStage(jurisdiction: Jurisdiction, currentStage: MatterStage): MatterStage | null {
  const workflow = MATTER_WORKFLOWS[jurisdiction];
  const index = workflow.indexOf(currentStage);
  if (index === -1) return null;
  return workflow[index + 1] ?? null;
}

/** "Next Stage" / "Next Milestone" display label (spec section 8/10), or null once the matter has reached the end of its workflow. */
export function nextMatterStageLabel(jurisdiction: Jurisdiction, currentStage: MatterStage): string | null {
  const next = nextMatterStage(jurisdiction, currentStage);
  return next ? MATTER_STAGE_LABELS[next] : null;
}
