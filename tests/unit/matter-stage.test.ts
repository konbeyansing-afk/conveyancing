/**
 * Matter Stage & Jurisdiction — pure logic. These are pure, so every branch
 * is cheap to pin down here rather than through the database-backed action
 * tests.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MATTER_STAGE,
  JURISDICTION_LABELS,
  JURISDICTION_VALUES,
  MATTER_STAGE_LABELS,
  MATTER_STAGE_VALUES,
  MATTER_TYPE_LABELS,
  MATTER_WORKFLOWS,
  isStageValidForJurisdiction,
  isValidMatterStage,
  matterStageOrder,
  matterWorkflow,
  nextMatterStage,
  nextMatterStageLabel,
  stageVisualState,
} from "@/lib/matter-stage";

describe("MATTER_WORKFLOWS", () => {
  it("gives QLD and NSW genuinely different sequences, not the same list relabelled", () => {
    expect(MATTER_WORKFLOWS.QLD).not.toEqual(MATTER_WORKFLOWS.NSW);
  });

  it("has every stage labelled", () => {
    for (const jurisdiction of JURISDICTION_VALUES) {
      for (const stage of MATTER_WORKFLOWS[jurisdiction]) {
        expect(MATTER_STAGE_LABELS[stage]).toBeTruthy();
      }
    }
  });

  it("starts and ends every workflow the same way", () => {
    for (const jurisdiction of JURISDICTION_VALUES) {
      const workflow = MATTER_WORKFLOWS[jurisdiction];
      expect(workflow[0]).toBe("MATTER_OPENING");
      expect(workflow.at(-1)).toBe("COMPLETED");
    }
  });

  it("never repeats a stage within one jurisdiction's workflow", () => {
    for (const jurisdiction of JURISDICTION_VALUES) {
      const workflow = MATTER_WORKFLOWS[jurisdiction];
      expect(new Set(workflow).size).toBe(workflow.length);
    }
  });

  it("QLD includes its jurisdiction-specific stages and excludes NSW's", () => {
    expect(MATTER_WORKFLOWS.QLD).toContain("CONTRACT_SIGNED");
    expect(MATTER_WORKFLOWS.QLD).toContain("BUILDING_PEST");
    expect(MATTER_WORKFLOWS.QLD).not.toContain("CONTRACT_EXCHANGE");
    expect(MATTER_WORKFLOWS.QLD).not.toContain("SETTLEMENT_PREPARATION");
    expect(MATTER_WORKFLOWS.QLD).not.toContain("LODGEMENT_REGISTRATION");
  });

  it("NSW includes its jurisdiction-specific stages and excludes QLD's", () => {
    expect(MATTER_WORKFLOWS.NSW).toContain("CONTRACT_EXCHANGE");
    expect(MATTER_WORKFLOWS.NSW).toContain("SETTLEMENT_PREPARATION");
    expect(MATTER_WORKFLOWS.NSW).toContain("LODGEMENT_REGISTRATION");
    expect(MATTER_WORKFLOWS.NSW).not.toContain("CONTRACT_SIGNED");
    expect(MATTER_WORKFLOWS.NSW).not.toContain("BUILDING_PEST");
  });

  it("orders NSW's Pre-Settlement ahead of Searches/Finance, unlike QLD", () => {
    const nsw = MATTER_WORKFLOWS.NSW;
    expect(nsw.indexOf("PRE_SETTLEMENT")).toBeLessThan(nsw.indexOf("SEARCHES"));
    expect(nsw.indexOf("PRE_SETTLEMENT")).toBeLessThan(nsw.indexOf("FINANCE"));

    const qld = MATTER_WORKFLOWS.QLD;
    expect(qld.indexOf("SEARCHES")).toBeLessThan(qld.indexOf("PRE_SETTLEMENT"));
    expect(qld.indexOf("FINANCE")).toBeLessThan(qld.indexOf("PRE_SETTLEMENT"));
  });
});

describe("matterWorkflow", () => {
  it("returns the right list per jurisdiction", () => {
    expect(matterWorkflow("QLD")).toEqual(MATTER_WORKFLOWS.QLD);
    expect(matterWorkflow("NSW")).toEqual(MATTER_WORKFLOWS.NSW);
  });
});

describe("isValidMatterStage", () => {
  it("accepts every declared stage", () => {
    for (const stage of MATTER_STAGE_VALUES) expect(isValidMatterStage(stage)).toBe(true);
  });

  it("rejects nonsense", () => {
    expect(isValidMatterStage("NOT_A_STAGE")).toBe(false);
    expect(isValidMatterStage("")).toBe(false);
  });
});

describe("isStageValidForJurisdiction", () => {
  it("a QLD-only stage is valid for QLD but not NSW", () => {
    expect(isStageValidForJurisdiction("QLD", "CONTRACT_SIGNED")).toBe(true);
    expect(isStageValidForJurisdiction("NSW", "CONTRACT_SIGNED")).toBe(false);
  });

  it("an NSW-only stage is valid for NSW but not QLD", () => {
    expect(isStageValidForJurisdiction("NSW", "CONTRACT_EXCHANGE")).toBe(true);
    expect(isStageValidForJurisdiction("QLD", "CONTRACT_EXCHANGE")).toBe(false);
  });

  it("a shared stage is valid for both", () => {
    expect(isStageValidForJurisdiction("QLD", "SEARCHES")).toBe(true);
    expect(isStageValidForJurisdiction("NSW", "SEARCHES")).toBe(true);
  });
});

describe("matterStageOrder", () => {
  it("increases monotonically along a jurisdiction's own workflow", () => {
    const workflow = matterWorkflow("QLD");
    for (let i = 1; i < workflow.length; i++) {
      expect(matterStageOrder("QLD", workflow[i])).toBeGreaterThan(matterStageOrder("QLD", workflow[i - 1]));
    }
  });

  it("is -1 for a stage that does not belong to the jurisdiction", () => {
    expect(matterStageOrder("NSW", "CONTRACT_SIGNED")).toBe(-1);
  });
});

describe("stageVisualState", () => {
  it("marks the matching stage current", () => {
    expect(stageVisualState("QLD", "SEARCHES", "SEARCHES")).toBe("current");
  });

  it("marks the current stage blocked when work status is Blocked", () => {
    expect(stageVisualState("QLD", "SEARCHES", "SEARCHES", true)).toBe("blocked");
  });

  it("never marks a non-current stage blocked, even when work is blocked", () => {
    expect(stageVisualState("QLD", "PRE_SETTLEMENT", "SEARCHES", true)).toBe("upcoming");
    expect(stageVisualState("QLD", "CONTRACT_REVIEW", "SEARCHES", true)).toBe("completed");
  });

  it("marks earlier stages completed and later stages upcoming", () => {
    expect(stageVisualState("QLD", "MATTER_OPENING", "PRE_SETTLEMENT")).toBe("completed");
    expect(stageVisualState("QLD", "SETTLEMENT", "PRE_SETTLEMENT")).toBe("upcoming");
  });

  it("classifies correctly along NSW's differently-ordered workflow too", () => {
    // In NSW, Pre-Settlement comes before Searches — so once the matter is at
    // Searches, Pre-Settlement must read as completed, not upcoming.
    expect(stageVisualState("NSW", "PRE_SETTLEMENT", "SEARCHES")).toBe("completed");
    expect(stageVisualState("NSW", "FINANCE", "SEARCHES")).toBe("upcoming");
  });
});

describe("nextMatterStage / nextMatterStageLabel", () => {
  it("returns the following stage in the jurisdiction's own workflow", () => {
    expect(nextMatterStage("QLD", "MATTER_OPENING")).toBe("CONTRACT_REVIEW");
    expect(nextMatterStage("NSW", "MATTER_OPENING")).toBe("CONTRACT_REVIEW");
    expect(nextMatterStage("NSW", "COOLING_OFF")).toBe("PRE_SETTLEMENT");
    expect(nextMatterStage("QLD", "COOLING_OFF")).toBe("FINANCE");
  });

  it("returns null once at the final stage", () => {
    expect(nextMatterStage("QLD", "COMPLETED")).toBeNull();
    expect(nextMatterStageLabel("QLD", "COMPLETED")).toBeNull();
  });

  it("label matches MATTER_STAGE_LABELS for the next stage", () => {
    expect(nextMatterStageLabel("QLD", "MATTER_OPENING")).toBe(MATTER_STAGE_LABELS.CONTRACT_REVIEW);
  });
});

describe("labels", () => {
  it("every declared jurisdiction, matter type and stage has a human label", () => {
    for (const j of JURISDICTION_VALUES) expect(JURISDICTION_LABELS[j]).toBeTruthy();
    for (const t of Object.keys(MATTER_TYPE_LABELS) as (keyof typeof MATTER_TYPE_LABELS)[]) {
      expect(MATTER_TYPE_LABELS[t]).toBeTruthy();
    }
    for (const s of MATTER_STAGE_VALUES) expect(MATTER_STAGE_LABELS[s]).toBeTruthy();
  });

  it("DEFAULT_MATTER_STAGE is valid in both jurisdictions", () => {
    expect(isStageValidForJurisdiction("QLD", DEFAULT_MATTER_STAGE)).toBe(true);
    expect(isStageValidForJurisdiction("NSW", DEFAULT_MATTER_STAGE)).toBe(true);
  });
});
