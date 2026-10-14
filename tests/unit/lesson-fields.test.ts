// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { isAnswerStep, isTraineeFillableStep, makeFieldsFillable, type FieldChange } from "@/lib/lesson-fields";

function setup(html: string, saved: Record<string, string> = {}, stepIndex = 4, answerStep = false) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const changes: FieldChange[] = [];
  makeFieldsFillable(container, { stepIndex, saved, answerStep, onChange: (c) => changes.push(c) });
  return { container, changes };
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

  it("report what was typed, labelled by row and column", () => {
    const { container, changes } = setup(table);
    const fields = container.querySelectorAll("textarea");
    type(fields[2], "Read the contract again");
    expect(changes).toEqual([{ key: "s4-cell-2", label: "Fixed row — Action", value: "Read the contract again" }]);
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
    expect(changes[0]).toEqual({ key: "s4-blank-1", label: "Signature", value: "S. Castro" });
    expect(container.textContent).toContain("Trainee Name:");
  });

  it("label a blank after bold text by that text", () => {
    const { container, changes } = setup(`<p><strong>Modules to review:</strong> ______________</p>`);
    type(container.querySelector("input")!, "3.2");
    expect(changes[0].label).toBe("Modules to review");
  });
});

describe("Checkboxes", () => {
  it("replace the ☐ character and report checked/unchecked", () => {
    const { container, changes } = setup(`<p>☐ I have read the handbook</p>`);
    const box = container.querySelector("input[type=checkbox]") as HTMLInputElement;
    expect(container.textContent).not.toContain("☐");
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    box.checked = false;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(changes).toEqual([
      { key: "s4-box-0", label: "I have read the handbook", value: "checked" },
      { key: "s4-box-0", label: "I have read the handbook", value: "" },
    ]);
  });
});

describe("Restoring saved answers", () => {
  it("fills fields in from what was saved under the same keys", () => {
    const { container } = setup(
      `<p>Name: ________</p><p>☐ Done</p><table><tbody><tr><td><p></p></td></tr></tbody></table>`,
      { "s4-blank-0": "Princess", "s4-box-0": "checked", "s4-cell-0": "Plan A" },
    );
    expect((container.querySelector("input[type=text]") as HTMLInputElement).value).toBe("Princess");
    expect((container.querySelector("input[type=checkbox]") as HTMLInputElement).checked).toBe(true);
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Plan A");
  });

  it("uses the step index so two sections never share a key", () => {
    const a = setup(`<p>x: ________</p>`, {}, 1);
    const b = setup(`<p>x: ________</p>`, {}, 2);
    type(a.container.querySelector("input")!, "1");
    type(b.container.querySelector("input")!, "2");
    expect(a.changes[0].key).toBe("s1-blank-0");
    expect(b.changes[0].key).toBe("s2-blank-0");
  });

  it("does not fire for content that has no blanks", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    container.innerHTML = `<p>Just reading</p><table><tbody><tr><td><p>filled</p></td></tr></tbody></table>`;
    makeFieldsFillable(container, { stepIndex: 0, saved: {}, onChange });
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
      2,
      true,
    );
    const boxes = container.querySelectorAll("textarea");
    expect(boxes.length).toBe(3);
    type(boxes[2], "Escalate it");
    expect(changes[0]).toEqual({
      key: "s2-ans-2",
      label: "Scenario 2 – Conflict Checking — 1. What is the correct immediate response?",
      value: "Escalate it",
    });
  });

  it("puts one box under each list when the section has no numbered prompts", () => {
    const { container, changes } = setup(
      `<h2>Part D – Process Ordering</h2><h3>Exercise 1 – Matter Journey</h3><ul><li>Settlement</li><li>Enquiry</li></ul>
       <h3>Exercise 2 – Conflict Check</h3><ul><li>Record</li><li>Search</li></ul>`,
      {},
      1,
      true,
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
      3,
      true,
    );
    const boxes = container.querySelectorAll("textarea");
    expect(boxes.length).toBe(4);
    expect(container.textContent).toContain("Mock File 1");
    type(boxes[1], "Seller");
    expect(changes[0].label).toBe("Mock File 2 – Seller-Side Matter — 1. Identify the transaction side");
  });

  it("never leaves a written-answer section without somewhere to write", () => {
    const { container, changes } = setup(`<h2>Practical Exercise</h2><p>Using a fictional instruction, complete the checklist.</p>`, {}, 5, true);
    const boxes = container.querySelectorAll("textarea");
    expect(boxes.length).toBe(1);
    type(boxes[0], "done");
    expect(changes[0]).toEqual({ key: "s5-ans-0", label: "Your response", value: "done" });
  });

  it("does not turn numbered steps in an ordinary section into questions", () => {
    const { container } = setup(`<h2>Step-by-Step General Workflow</h2><p>1. Receive the instruction</p><p>2. Confirm the details</p>`, {}, 6, false);
    expect(container.querySelectorAll("textarea,input").length).toBe(0);
  });

  it("restores saved written answers", () => {
    const { container } = setup(`<h2>Reflection</h2><p>1. What did you learn?</p>`, { "s1-ans-0": "How to escalate" }, 1, true);
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("How to escalate");
  });

  it("leaves a table alone when one of its columns belongs to the trainer", () => {
    const { container } = setup(
      `<table><tbody><tr><th><p>Trainer Signature</p></th><th><p>Date</p></th></tr><tr><td><p></p></td><td><p></p></td></tr></tbody></table>`,
    );
    expect(container.querySelectorAll("textarea").length).toBe(0);
  });
});
