/**
 * Checklist template integrity — every template must be internally
 * consistent on its own terms, independent of any matter/database. These
 * are the same invariants the Matter Health panel checks live against a
 * real matter's tasks; here they're checked once, exhaustively, against
 * the template source itself.
 */

import { describe, expect, it } from "vitest";
import { CHECKLIST_TEMPLATES, checklistTemplate, hasChecklistTemplate } from "@/lib/checklist-templates";
import { MATTER_WORKFLOWS } from "@/lib/matter-stage";
import type { Jurisdiction, MatterType } from "@prisma/client";

const COMBINATIONS: [Jurisdiction, MatterType][] = [
  ["QLD", "PURCHASE"],
  ["QLD", "SALE"],
  ["NSW", "PURCHASE"],
  ["NSW", "SALE"],
];

describe("every checklist template", () => {
  it.each(COMBINATIONS)("%s %s has no duplicate task keys", (jurisdiction, matterType) => {
    const template = CHECKLIST_TEMPLATES[jurisdiction][matterType];
    const keys = template.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(COMBINATIONS)("%s %s has at least one required task", (jurisdiction, matterType) => {
    const template = CHECKLIST_TEMPLATES[jurisdiction][matterType];
    expect(template.some((t) => t.required !== false)).toBe(true);
  });

  it.each(COMBINATIONS)("%s %s only assigns tasks to stages valid for that jurisdiction", (jurisdiction, matterType) => {
    const template = CHECKLIST_TEMPLATES[jurisdiction][matterType];
    const workflow = MATTER_WORKFLOWS[jurisdiction];
    for (const task of template) {
      expect(workflow, `"${task.title}" assigned to ${task.stage}`).toContain(task.stage);
    }
  });

  it.each(COMBINATIONS)("%s %s only has dependsOn keys that exist in the same template", (jurisdiction, matterType) => {
    const template = CHECKLIST_TEMPLATES[jurisdiction][matterType];
    const keys = new Set(template.map((t) => t.key));
    for (const task of template) {
      for (const dep of task.dependsOn ?? []) {
        expect(keys.has(dep), `"${task.title}" depends on unknown key "${dep}"`).toBe(true);
      }
    }
  });

  it.each(COMBINATIONS)("%s %s never has a task depend on itself", (jurisdiction, matterType) => {
    const template = CHECKLIST_TEMPLATES[jurisdiction][matterType];
    for (const task of template) {
      expect(task.dependsOn ?? []).not.toContain(task.key);
    }
  });
});

describe("QLD and NSW are genuinely different checklists, not relabelled copies", () => {
  it("QLD Purchaser and NSW Purchaser share no task keys", () => {
    const qldKeys = new Set(CHECKLIST_TEMPLATES.QLD.PURCHASE.map((t) => t.key));
    const nswKeys = CHECKLIST_TEMPLATES.NSW.PURCHASE.map((t) => t.key);
    expect(nswKeys.some((k) => qldKeys.has(k))).toBe(false);
  });

  it("QLD Vendor and NSW Vendor share no task keys", () => {
    const qldKeys = new Set(CHECKLIST_TEMPLATES.QLD.SALE.map((t) => t.key));
    const nswKeys = CHECKLIST_TEMPLATES.NSW.SALE.map((t) => t.key);
    expect(nswKeys.some((k) => qldKeys.has(k))).toBe(false);
  });

  it("Purchaser and Vendor checklists differ within the same jurisdiction", () => {
    expect(CHECKLIST_TEMPLATES.QLD.PURCHASE).not.toEqual(CHECKLIST_TEMPLATES.QLD.SALE);
    expect(CHECKLIST_TEMPLATES.NSW.PURCHASE).not.toEqual(CHECKLIST_TEMPLATES.NSW.SALE);
  });
});

describe("QLD Purchaser — spot-checks against the brief's verbatim wording", () => {
  const titles = CHECKLIST_TEMPLATES.QLD.PURCHASE.map((t) => t.title);

  it("preserves the exact task wording given", () => {
    expect(titles).toContain("Draft Form 2 Seller Disclosure Statement");
    expect(titles).toContain("Accept PEXA Workspace Invitation from PSOL");
    expect(titles).toContain("Sign PEXA Workspace / Transfer Documents");
  });

  it("does not contain NSW-only terminology", () => {
    expect(titles.some((t) => t.includes("S22"))).toBe(false);
    expect(titles.some((t) => t.includes("RoT"))).toBe(false);
  });
});

describe("QLD Vendor — spot-checks against the brief's verbatim wording", () => {
  const titles = CHECKLIST_TEMPLATES.QLD.SALE.map((t) => t.title);

  it("preserves the exact task wording given", () => {
    expect(titles).toContain("Send to PSOL - S47");
    expect(titles).toContain("Send to PSOL - S184");
    expect(titles).toContain("Nomination prepared");
  });
});

describe("NSW checklists — spot-checks against the supplied task text", () => {
  it("Purchaser preserves the supplied wording and excludes client-identifying header data", () => {
    const titles = CHECKLIST_TEMPLATES.NSW.PURCHASE.map((t) => t.title);
    expect(titles.some((t) => t.includes("YES - email the VSOL"))).toBe(true);
    expect(titles.some((t) => t.includes("Order stat enquiries"))).toBe(true);
    // The screenshot's matter header (client name, address, dates) must never appear in task text.
    const joined = titles.join(" ");
    expect(joined).not.toContain("BOTEV");
    expect(joined).not.toContain("Halifax Street");
  });

  it("Vendor preserves the supplied wording and excludes client-identifying header data", () => {
    const titles = CHECKLIST_TEMPLATES.NSW.SALE.map((t) => t.title);
    expect(titles.some((t) => t.includes("NO - Wait for PSOL to send the RoT"))).toBe(true);
    expect(titles.some((t) => t.includes("PSOL signed S22"))).toBe(true);
    const joined = titles.join(" ");
    expect(joined).not.toContain("BOTEV");
    expect(joined).not.toContain("Halifax Street");
  });

  it("NSW Purchaser and NSW Vendor are genuinely different checklists", () => {
    expect(CHECKLIST_TEMPLATES.NSW.PURCHASE).not.toEqual(CHECKLIST_TEMPLATES.NSW.SALE);
  });
});

describe("checklistTemplate / hasChecklistTemplate", () => {
  it("returns an empty list, and reports false, when matterType is null", () => {
    expect(checklistTemplate("QLD", null)).toEqual([]);
    expect(hasChecklistTemplate("QLD", null)).toBe(false);
  });

  it("returns the real template, and reports true, for every jurisdiction/matterType combination", () => {
    for (const [jurisdiction, matterType] of COMBINATIONS) {
      expect(checklistTemplate(jurisdiction, matterType).length).toBeGreaterThan(0);
      expect(hasChecklistTemplate(jurisdiction, matterType)).toBe(true);
    }
  });
});
