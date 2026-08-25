/**
 * Data entry drills — the shared scoring logic in src/lib/training/drill.tsx,
 * and the Actionstep drill content built on top of it.
 *
 * The scoring has to tolerate the ways a real person legitimately writes the
 * same value ("$1,875,000" vs "1875000", "08/08/2026" vs "2026-08-08")
 * without accepting a genuinely wrong answer, so that is most of what these
 * tests check.
 */

import { describe, expect, it } from "vitest";
import { checkDrillField, scoreDrill, type Drill } from "@/lib/training/drill";
import { AS_DRILLS } from "@/lib/actionstep/drills";

describe("checkDrillField — money", () => {
  it("accepts a plain number matching the canonical expected value", () => {
    expect(checkDrillField("money", "1395000", "1395000")).toBe(true);
  });

  it("accepts common currency formatting", () => {
    expect(checkDrillField("money", "$1,395,000.00", "1395000")).toBe(true);
    expect(checkDrillField("money", " 1,395,000 ", "1395000")).toBe(true);
  });

  it("rejects a different amount", () => {
    expect(checkDrillField("money", "1395001", "1395000")).toBe(false);
  });

  it("rejects an empty answer", () => {
    expect(checkDrillField("money", "   ", "1395000")).toBe(false);
  });
});

describe("checkDrillField — date", () => {
  it("accepts ISO format", () => {
    expect(checkDrillField("date", "2026-08-08", "2026-08-08")).toBe(true);
  });

  it("accepts Australian dd/mm/yyyy against a canonical ISO expected value", () => {
    expect(checkDrillField("date", "08/08/2026", "2026-08-08")).toBe(true);
  });

  it("rejects a different date", () => {
    expect(checkDrillField("date", "2026-08-09", "2026-08-08")).toBe(false);
  });

  it("does not silently match on an unparseable date", () => {
    expect(checkDrillField("date", "sometime in August", "2026-08-08")).toBe(false);
  });
});

describe("checkDrillField — choice and text", () => {
  it("is case- and whitespace-insensitive", () => {
    expect(checkDrillField("choice", "  yes ", "Yes")).toBe(true);
    expect(checkDrillField("text", "AGENT", "Agent")).toBe(true);
  });

  it("rejects a different choice", () => {
    expect(checkDrillField("choice", "No", "Yes")).toBe(false);
  });
});

describe("scoreDrill", () => {
  const drill: Drill = {
    id: "test-drill",
    title: "Test drill",
    summary: "",
    difficulty: "Beginner",
    minutes: 1,
    brief: "",
    document: { heading: "", paragraphs: [] },
    fields: [
      { key: "a", label: "A", type: "text" },
      { key: "b", label: "B", type: "money" },
    ],
    expected: { a: "Agent", b: "1000" },
  };

  it("scores every field independently and totals the correct count", () => {
    const result = scoreDrill(drill, { a: "agent", b: "999" });
    expect(result.results).toEqual({ a: true, b: false });
    expect(result.correct).toBe(1);
    expect(result.total).toBe(2);
  });

  it("treats a missing answer as incorrect rather than throwing", () => {
    const result = scoreDrill(drill, { a: "Agent" });
    expect(result.results.b).toBe(false);
  });

  it("scores a fully correct submission", () => {
    const result = scoreDrill(drill, { a: "Agent", b: "$1,000" });
    expect(result.correct).toBe(2);
  });
});

describe("Actionstep drill content", () => {
  it("ships at least one drill with unique ids", () => {
    expect(AS_DRILLS.length).toBeGreaterThan(0);
    expect(new Set(AS_DRILLS.map((d) => d.id)).size).toBe(AS_DRILLS.length);
  });

  it("gives every field an expected value the field itself would accept", () => {
    for (const drill of AS_DRILLS) {
      expect(drill.fields.length).toBeGreaterThan(0);
      for (const field of drill.fields) {
        const expected = drill.expected[field.key];
        expect(expected, `${drill.id}.${field.key} has no expected value`).toBeTruthy();
        expect(checkDrillField(field.type, expected, expected)).toBe(true);
        if (field.type === "choice") {
          expect(field.choices ?? []).toContain(expected);
        }
      }
    }
  });

  it("has a non-empty source document behind every drill", () => {
    for (const drill of AS_DRILLS) {
      expect(drill.document.heading.trim().length).toBeGreaterThan(0);
      expect(drill.document.paragraphs.length).toBeGreaterThan(0);
    }
  });
});
