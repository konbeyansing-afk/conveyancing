// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  STABLE_KEY,
  isAnswerStep,
  isTraineeFillableStep,
  makeFieldsFillable,
  stableFieldKey,
  type FieldChange,
  type FieldDescriptor,
  type SavedAnswer,
} from "@/lib/lesson-fields";

type SavedInput = string | SavedAnswer;

function setup(
  html: string,
  saved: Record<string, SavedInput> = {},
  opts: { stepIndex?: number; answerStep?: boolean; stepTitle?: string } = {},
) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const changes: FieldChange[] = [];
  const normalised = Object.fromEntries(
    Object.entries(saved).map(([k, v]) => [k, typeof v === "string" ? { value: v, trusted: true } : v]),
  );
  const fields: FieldDescriptor[] = makeFieldsFillable(container, {
    stepIndex: opts.stepIndex ?? 4,
    stepTitle: opts.stepTitle ?? "Section",
    answerStep: opts.answerStep ?? false,
    saved: normalised,
    onChange: (c) => changes.push(c),
  });
  return { container, changes, fields };
}

function type(el: Element, value: string) {
  (el as HTMLInputElement | HTMLTextAreaElement).value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Which sections a trainee fills in", () => {
  it("leaves trainer-completed sections alone", () => {
    expect(isTraineeFillableStep("6. Trainer Competency Checklist")).toBe(false);
    expect(isTraineeFillableStep("9. Trainer Sign-Off")).toBe(false);
    expect(isTraineeFillableStep("7. Assessment Record")).toBe(false);
    expect(isTraineeFillableStep("10. Progression Recommendation")).toBe(false);
  });

  it("treats everything else as the trainee's", () => {
    expect(isTraineeFillableStep("4. Personal Action Plan")).toBe(true);
    expect(isTraineeFillableStep("Part F — Practical Scenarios (5 Scenarios)")).toBe(true);
    expect(isTraineeFillableStep("8. Trainee Acknowledgement")).toBe(true);
  });
});

describe("Empty table cells", () => {
  const table = `<table><tbody>
    <tr><th><p>Area</p></th><th><p>Action</p></th></tr>
    <tr><td><p></p></td><td><p></p></td></tr>
    <tr><td><p>Fixed row</p></td><td><p></p></td></tr>
  </tbody></table>`;

  it("become textareas, and cells that already have text do not", () => {
    const { container } = setup(table);
    expect(container.querySelectorAll("textarea").length).toBe(3);
    expect(container.querySelector("td")?.querySelector("textarea")).not.toBeNull();
  });

  it("report what was typed under a stable key, labelled by row and column", () => {
    const { container, changes, fields } = setup(table);
    type(container.querySelectorAll("textarea")[2], "Read the contract again");
    expect(changes[0]).toMatchObject({
      label: "Fixed row — Action",
      section: "Section",
      position: 2,
      value: "Read the contract again",
    });
    expect(changes[0].key).toMatch(STABLE_KEY);
    expect(changes[0].key).toBe(fields[2].key);
    expect(fields[2].legacyKey).toBe("s4-cell-2");
  });

  it("label a cell by every other filled cell in its row, so a numbered term is not lost", () => {
    const { container, changes } = setup(`<table><tbody>
      <tr><th><p>#</p></th><th><p>Term</p></th><th><p>Your Answer</p></th></tr>
      <tr><td><p>1</p></td><td><p>Mortgagee</p></td><td><p></p></td></tr>
    </tbody></table>`);
    type(container.querySelector("textarea")!, "C");
    expect(changes[0].label).toBe("1 · Mortgagee — Your Answer");
  });

  it("label an all-empty row by its position", () => {
    const { container, changes } = setup(table);
    type(container.querySelector("textarea")!, "x");
    expect(changes[0].label).toBe("Row 1 — Area");
  });
});

describe("Blank lines", () => {
  it("turn a lone line of underscores into a written-answer box, labelled by its scenario", () => {
    const { container, changes } = setup(
      `<p>Scenario 2 — Legal Advice Boundary</p><div data-callout><p>WARNING a buyer asks</p></div><p>Your response:</p><p>__________________</p>`,
    );
    const box = container.querySelector("textarea")!;
    expect(box).not.toBeNull();
    expect(container.textContent).not.toContain("____");
    type(box, "I would escalate it");
    expect(changes[0].label).toBe("Scenario 2 — Legal Advice Boundary — Your response");
  });

  it("turn blanks inside a sentence into inline inputs labelled by the words before them", () => {
    const { container, changes } = setup(`<p>Trainee Name: ______________ Signature: ______________ Date: ________</p>`);
    const inputs = container.querySelectorAll("input[type=text]");
    expect(inputs.length).toBe(3);
    type(inputs[1], "S. Castro");
    expect(changes[0]).toMatchObject({ label: "Signature", value: "S. Castro" });
    expect(container.textContent).toContain("Trainee Name:");
  });

  it("label a blank after bold text by that text", () => {
    const { container, changes } = setup(`<p><strong>Modules to review:</strong> ______________</p>`);
    type(container.querySelector("input")!, "3.2");
    expect(changes[0].label).toBe("Modules to review");
  });
});

describe("Checkboxes", () => {
  it("replace the ☐ character and report checked/unchecked under one stable key", () => {
    const { container, changes } = setup(`<p>☐ I have read the handbook</p>`);
    const box = container.querySelector("input[type=checkbox]") as HTMLInputElement;
    expect(container.textContent).not.toContain("☐");
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    box.checked = false;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(changes.map((c) => c.value)).toEqual(["checked", ""]);
    expect(changes[0].key).toBe(changes[1].key);
    expect(changes[0].label).toBe("I have read the handbook");
  });
});

describe("Restoring saved answers", () => {
  it("fills fields in from answers saved under their stable keys", () => {
    const html = `<p>Name: ________</p><p>☐ Done</p><table><tbody><tr><td><p></p></td></tr></tbody></table>`;
    const first = setup(html);
    const valueFor = { blank: "Princess", box: "checked", cell: "Plan A", ans: "" } as const;
    const saved = Object.fromEntries(first.fields.map((f) => [f.key, { value: valueFor[f.kind], label: f.label }]));
    const { container } = setup(html, saved);
    expect((container.querySelector("input[type=text]") as HTMLInputElement).value).toBe("Princess");
    expect((container.querySelector("input[type=checkbox]") as HTMLInputElement).checked).toBe(true);
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Plan A");
  });

  it("does not fire for content that has no blanks", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    container.innerHTML = `<p>Just reading</p><table><tbody><tr><td><p>filled</p></td></tr></tbody></table>`;
    const fields = makeFieldsFillable(container, { stepIndex: 0, stepTitle: "Reading", saved: {}, onChange });
    expect(fields).toEqual([]);
    expect(container.querySelectorAll("input,textarea").length).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Written-answer sections (assessment parts, scenarios, mock files)", () => {
  it("recognises them by title and leaves ordinary explanation sections alone", () => {
    for (const title of [
      "Part G – Practical Scenarios (10 Scenarios)",
      "Part D – Process Ordering (5 Exercises)",
      "Part H – Mock File Exercise",
      "Reflection Question",
      "Practical Exercise",
      "8. Trainee Reflection Activity",
    ]) {
      expect(isAnswerStep(title), title).toBe(true);
    }
    for (const title of ["Step-by-Step General Workflow", "Key Terminology", "Common Mistakes", "Example", "Competency Checklist"]) {
      expect(isAnswerStep(title), title).toBe(false);
    }
  });

  it("keeps trainer-only material out of the trainee's reach", () => {
    expect(isTraineeFillableStep("7. Remediation Plan")).toBe(false);
    expect(isTraineeFillableStep("Answer Key and Marking Guide")).toBe(false);
  });

  it("gives every numbered scenario question its own box, labelled by the scenario", () => {
    const { container, changes } = setup(
      `<h2>Part G – Practical Scenarios</h2>
       <div data-callout><p><strong>NOTE — Scenario 1 – Matter Opening</strong>A new instruction arrives.</p></div>
       <p>1. What is the correct immediate response?</p>
       <p>2. What must the trainee avoid doing?</p>
       <div data-callout><p><strong>NOTE — Scenario 2 – Conflict Checking</strong>A search returns a match.</p></div>
       <p>1. What is the correct immediate response?</p>`,
      {},
      { stepIndex: 2, answerStep: true },
    );
    const boxes = container.querySelectorAll("textarea");
    expect(boxes.length).toBe(3);
    type(boxes[2], "Escalate it");
    expect(changes[0]).toMatchObject({
      label: "Scenario 2 – Conflict Checking — 1. What is the correct immediate response?",
      value: "Escalate it",
    });
  });

  it("puts one box under each list when the section has no numbered prompts", () => {
    const { container, changes } = setup(
      `<h2>Part D – Process Ordering</h2><h3>Exercise 1 – Matter Journey</h3><ul><li>Settlement</li><li>Enquiry</li></ul>
       <h3>Exercise 2 – Conflict Check</h3><ul><li>Record</li><li>Search</li></ul>`,
      {},
      { answerStep: true },
    );
    const boxes = container.querySelectorAll("textarea");
    expect(boxes.length).toBe(2);
    type(boxes[1], "Search then record");
    expect(changes[0].label).toBe("Exercise 2 – Conflict Check — Your answer");
  });

  it("gives each task a box per case when the tasks are for each of several files", () => {
    const { container, changes } = setup(
      `<h2>Part H – Mock File Exercise</h2>
       <h3>Mock File 1 – Buyer-Side Matter</h3><div data-callout><p><strong>NOTE</strong>Client: Mr Patel</p></div>
       <h3>Mock File 2 – Seller-Side Matter</h3><div data-callout><p><strong>NOTE</strong>Client: Ms Nguyen</p></div>
       <p>For each mock file, complete the following tasks:</p>
       <p>1. Identify the transaction side</p><p>2. Identify missing information</p>`,
      {},
      { answerStep: true },
    );
    const boxes = container.querySelectorAll("textarea");
    expect(boxes.length).toBe(4);
    expect(container.textContent).toContain("Mock File 1");
    type(boxes[1], "Seller");
    expect(changes[0].label).toBe("Mock File 2 – Seller-Side Matter — 1. Identify the transaction side");
  });

  it("never leaves a written-answer section without somewhere to write", () => {
    const { container, changes } = setup(
      `<h2>Practical Exercise</h2><p>Using a fictional instruction, complete the checklist.</p>`,
      {},
      { answerStep: true },
    );
    const boxes = container.querySelectorAll("textarea");
    expect(boxes.length).toBe(1);
    type(boxes[0], "done");
    expect(changes[0]).toMatchObject({ label: "Your response", value: "done" });
  });

  it("does not turn numbered steps in an ordinary section into questions", () => {
    const { container } = setup(`<h2>Step-by-Step General Workflow</h2><p>1. Receive the instruction</p><p>2. Confirm the details</p>`);
    expect(container.querySelectorAll("textarea,input").length).toBe(0);
  });

  it("leaves a table alone when one of its columns belongs to the trainer", () => {
    const { container } = setup(
      `<table><tbody><tr><th><p>Trainer Signature</p></th><th><p>Date</p></th></tr><tr><td><p></p></td><td><p></p></td></tr></tbody></table>`,
    );
    expect(container.querySelectorAll("textarea").length).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------
// Answer integrity: an answer must stay attached to the question it was written for,
// whatever else an admin later does to the lesson.
// ---------------------------------------------------------------------------------------

const prompt = (n: number, text: string) => `<p>${n}. ${text}</p>`;
const scenario = (n: number, title: string, ...questions: string[]) =>
  `<div data-callout><p><strong>NOTE — Scenario ${n} – ${title}</strong>Facts.</p></div>${questions
    .map((q, i) => prompt(i + 1, q))
    .join("")}`;

const heading = `<h2>Part G – Practical Scenarios</h2>`;
const S1 = scenario(1, "Matter Opening", "What is the correct immediate response?", "What must the trainee avoid doing?");
const S2 = scenario(2, "Conflict Checking", "What is the correct immediate response?", "Who should be notified?");
const S3 = scenario(3, "Identity Discrepancy", "What is the correct immediate response?");

/** Types a distinct answer into every field, returning the answers the server would have stored. */
function answerEverything(html: string) {
  const { container, fields } = setup(html, {}, { answerStep: true, stepTitle: "Part G – Practical Scenarios" });
  const boxes = Array.from(container.querySelectorAll("textarea"));
  const stored: Record<string, SavedAnswer> = {};
  const byLabel: Record<string, string> = {};
  boxes.forEach((box, i) => {
    const value = `answer to: ${fields[i].label}`;
    type(box, value);
    stored[fields[i].key] = { value, label: fields[i].label, trusted: false };
    byLabel[fields[i].label] = value;
  });
  return { stored, byLabel };
}

/** Renders `html` with previously stored answers and returns what ended up in each question's box, by label. */
function render(html: string, stored: Record<string, SavedAnswer>) {
  const { container, fields } = setup(html, stored, { answerStep: true, stepTitle: "Part G – Practical Scenarios" });
  const boxes = Array.from(container.querySelectorAll("textarea")) as HTMLTextAreaElement[];
  return Object.fromEntries(fields.map((f, i) => [f.label, boxes[i].value]));
}

describe("Answers stay with their question when the lesson is edited", () => {
  const original = heading + S1 + S2 + S3;
  const { stored, byLabel } = answerEverything(original);

  it("gives every question a different stable identity, even identical wording in different scenarios", () => {
    const keys = Object.keys(stored);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => STABLE_KEY.test(k))).toBe(true);
    expect(keys.length).toBe(5);
  });

  it("returns every answer to its own question on an unchanged lesson", () => {
    expect(render(original, stored)).toEqual(byLabel);
  });

  it("keeps answers on the right questions when scenarios are reordered", () => {
    const shown = render(heading + S3 + S1 + S2, stored);
    expect(shown).toEqual(byLabel);
  });

  it("keeps existing answers unchanged when a new question is added in the middle", () => {
    const extra = scenario(4, "Settlement Delay", "What is the correct immediate response?");
    const shown = render(heading + S1 + extra + S2 + S3, stored);
    for (const [label, value] of Object.entries(byLabel)) expect(shown[label], label).toBe(value);
    expect(shown["Scenario 4 – Settlement Delay — 1. What is the correct immediate response?"]).toBe("");
  });

  it("keeps existing answers unchanged when a question is added at the very top", () => {
    const first = scenario(0, "Warm-up", "Which document comes first?");
    const shown = render(heading + first + S1 + S2 + S3, stored);
    for (const [label, value] of Object.entries(byLabel)) expect(shown[label], label).toBe(value);
  });

  it("does not hand a removed question's answer to any other question", () => {
    const shown = render(heading + S1 + S3, stored);
    const removedValues = Object.entries(byLabel).filter(([label]) => label.startsWith("Scenario 2"));
    expect(removedValues.length).toBe(2);
    for (const [, value] of removedValues) expect(Object.values(shown)).not.toContain(value);
    for (const [label, value] of Object.entries(byLabel)) {
      if (!label.startsWith("Scenario 2")) expect(shown[label], label).toBe(value);
    }
  });

  it("does not move an answer when questions are renumbered", () => {
    const renumbered = heading + S1.replace(/<p>1\. /, "<p>5. ").replace(/<p>2\. /, "<p>6. ") + S2 + S3;
    const shown = render(renumbered, stored);
    expect(Object.values(shown).filter(Boolean).length).toBe(5);
  });

  it("treats a reworded question as a new question rather than reattaching the old answer to it", () => {
    const reworded = heading + S1.replace("What must the trainee avoid doing?", "What should be avoided?") + S2 + S3;
    const shown = render(reworded, stored);
    expect(shown["Scenario 1 – Matter Opening — 2. What should be avoided?"]).toBe("");
    expect(Object.values(shown)).not.toContain("answer to: Scenario 1 – Matter Opening — 2. What must the trainee avoid doing?");
  });

  it("tells repeated identical labels apart by occurrence", () => {
    const { fields } = setup(`<p>Date: ________</p><p>Date: ________</p><p>Date: ________</p>`);
    expect(new Set(fields.map((f) => f.key)).size).toBe(3);
    expect(stableFieldKey("S", "blank", "Date", 0)).not.toBe(stableFieldKey("S", "blank", "Date", 1));
  });

  it("derives the same identity every time, including across section numbering changes", () => {
    expect(stableFieldKey("4. Personal Action Plan", "cell", "Row 1 — Action", 0)).toBe(
      stableFieldKey("5. Personal Action Plan", "cell", "Row 1 — Action", 0),
    );
    expect(stableFieldKey("Plan", "cell", "Row 1 — Action", 0)).not.toBe(stableFieldKey("Plan", "cell", "Row 2 — Action", 0));
  });
});

describe("Answers saved under the old positional keys", () => {
  const html = `<p>Trainee Name: ________</p><p>Date: ________</p>`;

  it("are adopted when the lesson is known not to have changed since they were saved", () => {
    const { container, changes, fields } = setup(html, {
      "s4-blank-0": { value: "Chenilyn", label: "Trainee Name", trusted: true },
      "s4-blank-1": { value: "07/10/2026", label: "Date", trusted: true },
    });
    const inputs = container.querySelectorAll("input");
    expect((inputs[0] as HTMLInputElement).value).toBe("Chenilyn");
    expect((inputs[1] as HTMLInputElement).value).toBe("07/10/2026");

    // The first edit re-keys the row in place, carrying the legacy key so the server can find it.
    type(inputs[0], "Chenilyn M");
    expect(changes[0]).toMatchObject({ key: fields[0].key, legacyKey: "s4-blank-0", value: "Chenilyn M" });
  });

  it("are not adopted by a different question when the lesson has changed and the wording no longer matches", () => {
    // A question was inserted above, so position 0 is now a different field than when the answer was saved.
    const edited = `<p>Reviewer: ________</p><p>Trainee Name: ________</p><p>Date: ________</p>`;
    const { container } = setup(edited, {
      "s4-blank-0": { value: "Chenilyn", label: "Trainee Name", trusted: false },
    });
    const inputs = container.querySelectorAll("input");
    expect((inputs[0] as HTMLInputElement).value).toBe("");
  });

  it("are adopted on an edited lesson only when the stored wording still matches and is unique", () => {
    const { container } = setup(`<p>Reviewer: ________</p><p>Trainee Name: ________</p>`, {
      "s4-blank-1": { value: "Chenilyn", label: "Trainee Name", trusted: false },
    });
    expect((container.querySelectorAll("input")[1] as HTMLInputElement).value).toBe("Chenilyn");
  });

  it("are never adopted by one of several identically worded fields unless known to belong there", () => {
    const { container } = setup(`<p>Date: ________</p><p>Date: ________</p>`, {
      "s4-blank-0": { value: "07/10", label: "Date", trusted: false },
    });
    for (const input of Array.from(container.querySelectorAll("input"))) expect((input as HTMLInputElement).value).toBe("");
  });

  it("do not send a legacy key for an edit that did not adopt one", () => {
    const { container, changes } = setup(html);
    type(container.querySelector("input")!, "x");
    expect(changes[0].legacyKey).toBeUndefined();
  });
});
