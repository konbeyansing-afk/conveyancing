// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { isTraineeFillableStep, makeFieldsFillable, type FieldChange } from "@/lib/lesson-fields";

function setup(html: string, saved: Record<string, string> = {}, stepIndex = 4) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const changes: FieldChange[] = [];
  makeFieldsFillable(container, { stepIndex, saved, onChange: (c) => changes.push(c) });
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
