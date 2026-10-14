/**
 * Turns the printed blanks inside a lesson section into real inputs, without
 * touching the stored content: it works on the already-rendered DOM and the
 * caller restores the original markup on cleanup.
 *
 * What becomes a field:
 *   - an empty table cell             -> a one-row textarea
 *   - a paragraph that is only "____" -> a multi-line textarea (a written answer)
 *   - "____" inside other text        -> an inline text input (name, date, ...)
 *   - a "☐" character                 -> a checkbox
 *
 * Sections written for the trainer to complete (sign-off, competency checklist,
 * assessment record, recommendation) are left exactly as printed.
 */

export type FieldChange = { key: string; label: string; value: string };

/** The longest answer the server will store for one field. */
export const MAX_RESPONSE_LENGTH = 5000;

const TRAINER_STEP =
  /trainer|assessment record|progression recommendation|answer key|marking guide|remediation plan/i;

/** A table column or label that names the person who completes it: those cells are theirs, not the trainee's. */
const TRAINER_WORD = /\b(trainer|assessor|supervisor|marker)\b/i;

export function isTraineeFillableStep(title: string): boolean {
  return !TRAINER_STEP.test(title);
}

/**
 * Sections whose numbered prompts or lists are questions the trainee answers in
 * writing (assessment parts, scenarios, exercises, reflections). Deliberately
 * keyed off the section title: a numbered list in an ordinary explanation
 * ("Step-by-Step Workflow") is content to read, not something to answer.
 */
const ANSWER_STEP = /^part [a-z]\b|scenario|exercise|matching|ordering|identification|mock file|reflection|activity/i;

export function isAnswerStep(title: string): boolean {
  return ANSWER_STEP.test(title);
}

const RUN = /(_{4,}|☐)/;
const BLANK_ONLY = /^_{4,}$/;
const MAX_LABEL = 160;

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const tidyLabel = (text: string) => clean(text).replace(/[:：\s—-]+$/u, "").slice(0, MAX_LABEL);

/** "Row text — Column header" for a table cell, so a trainer can tell what was being answered. */
function cellLabel(td: Element): string {
  const row = td.parentElement;
  const table = td.closest("table");
  const cells = row ? Array.from(row.children) : [];
  const column = cells.indexOf(td);
  const headerRow = table?.querySelector("tr") ?? null;
  const header = headerRow && headerRow !== row ? clean(headerRow.children[column]?.textContent ?? "") : "";
  const rowText =
    cells
      .filter((c) => c !== td)
      .map((c) => clean(c.textContent ?? ""))
      .filter(Boolean)
      .join(" · ") || undefined;
  const rowIndex = table && row ? Array.from(table.querySelectorAll("tr")).indexOf(row as HTMLTableRowElement) : 0;
  return tidyLabel([rowText ?? `Row ${rowIndex}`, header].filter(Boolean).join(" — "));
}

/** What a free-standing blank is answering: the nearest preceding prompt, plus its scenario/question heading if there is one. */
function blockLabel(el: Element): string {
  let prev = el.previousElementSibling;
  let nearest = "";
  while (prev && !(nearest = clean(prev.textContent ?? ""))) prev = prev.previousElementSibling;
  if (!nearest) return "Your response";
  if (nearest.length > 40) return tidyLabel(nearest.slice(0, 80));

  let heading = "";
  let p = prev?.previousElementSibling ?? null;
  while (p) {
    if (/^(P|H[1-6])$/.test(p.tagName)) {
      const text = clean(p.textContent ?? "");
      if (/^(scenario|question|case|part|\d+[.)])/i.test(text)) {
        heading = text;
        break;
      }
    }
    p = p.previousElementSibling;
  }
  return tidyLabel(heading ? `${heading} — ${nearest}` : nearest);
}

const LABEL_PREFIX = /^(note|warning|tip|important)\s*[—–:-]\s*/i;
const BARE_LABEL = /^(note|warning|tip|important)$/i;

/** The nearest heading or callout title above a prompt — "Scenario 3 — Identity Discrepancy", "Exercise 2 — ...". */
function promptContext(el: Element): string {
  let prev = el.previousElementSibling;
  while (prev) {
    if (/^H[1-6]$/.test(prev.tagName)) return tidyLabel(prev.textContent ?? "");
    if (prev.hasAttribute("data-callout")) {
      const strong = clean(prev.querySelector("strong")?.textContent ?? "");
      if (!BARE_LABEL.test(strong)) {
        const title = strong || clean(prev.textContent ?? "");
        return tidyLabel(title.replace(LABEL_PREFIX, "").slice(0, 80));
      }
    }
    prev = prev.previousElementSibling;
  }
  return "";
}

function rowLabelFor(el: Element): string {
  const td = el.closest("td");
  return td ? cellLabel(td) : "";
}

export function makeFieldsFillable(
  container: HTMLElement,
  opts: {
    stepIndex: number;
    saved: Record<string, string>;
    onChange: (change: FieldChange) => void;
    /** The section is a written-answer one (see isAnswerStep): give its prompts somewhere to write. */
    answerStep?: boolean;
  },
): void {
  const doc = container.ownerDocument;
  const counters = { cell: 0, blank: 0, box: 0, ans: 0 };
  const nextKey = (kind: keyof typeof counters) => `s${opts.stepIndex}-${kind}-${counters[kind]++}`;

  const bind = (el: HTMLInputElement | HTMLTextAreaElement, key: string, label: string) => {
    el.setAttribute("aria-label", label || "Your answer");
    const saved = opts.saved[key];
    if ((el as HTMLInputElement).type === "checkbox") {
      const box = el as HTMLInputElement;
      box.checked = saved === "checked";
      box.addEventListener("change", () => opts.onChange({ key, label, value: box.checked ? "checked" : "" }));
    } else {
      if (saved !== undefined) el.value = saved;
      el.addEventListener("input", () => opts.onChange({ key, label, value: el.value }));
    }
  };

  const makeTextarea = (rows: number) => {
    const field = doc.createElement("textarea");
    field.rows = rows;
    field.className = "lesson-field";
    return field;
  };

  for (const td of Array.from(container.querySelectorAll("td"))) {
    if (clean(td.textContent ?? "") !== "" || td.querySelector("img,input,textarea")) continue;
    const headerText = clean(td.closest("table")?.querySelector("tr")?.textContent ?? "");
    if (TRAINER_WORD.test(headerText)) continue;
    const label = cellLabel(td);
    if (TRAINER_WORD.test(label)) continue;
    const field = makeTextarea(1);
    td.textContent = "";
    td.appendChild(field);
    bind(field, nextKey("cell"), label);
  }

  const walker = doc.createTreeWalker(container, 4 /* NodeFilter.SHOW_TEXT */);
  const targets: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (RUN.test(text.data) && !text.parentElement?.closest("textarea,script,style")) targets.push(text);
  }

  for (const text of targets) {
    const parent = text.parentElement;
    if (!parent) continue;

    if (parent.tagName === "P" && BLANK_ONLY.test(clean(parent.textContent ?? ""))) {
      const label = blockLabel(parent);
      const field = makeTextarea(3);
      parent.textContent = "";
      parent.appendChild(field);
      bind(field, nextKey("blank"), label);
      continue;
    }

    const parts = text.data.split(RUN);
    const fragment = doc.createDocumentFragment();
    parts.forEach((part, i) => {
      if (BLANK_ONLY.test(part)) {
        const before = tidyLabel(parts[i - 1] ?? "");
        let label = before;
        if (!label) {
          let sibling: ChildNode | null = text.previousSibling;
          let preceding = "";
          while (sibling && !(preceding = clean(sibling.textContent ?? ""))) sibling = sibling.previousSibling;
          label = tidyLabel(preceding) || rowLabelFor(parent) || blockLabel(parent);
        }
        if (TRAINER_WORD.test(label)) {
          fragment.appendChild(doc.createTextNode(part));
          return;
        }
        const field = doc.createElement("input");
        field.type = "text";
        field.className = "lesson-field lesson-field-inline";
        field.style.width = `${Math.min(Math.max(part.length, 10), 36)}ch`;
        fragment.appendChild(field);
        bind(field, nextKey("blank"), label);
      } else if (part === "☐") {
        const after = tidyLabel(parts[i + 1] ?? "");
        const field = doc.createElement("input");
        field.type = "checkbox";
        field.className = "lesson-field";
        fragment.appendChild(field);
        bind(field, nextKey("box"), after || rowLabelFor(parent) || tidyLabel(parent.textContent ?? ""));
      } else if (part !== "") {
        fragment.appendChild(doc.createTextNode(part));
      }
    });
    parent.replaceChild(fragment, text);
  }

  if (!opts.answerStep) return;

  const addAnswers = (after: Element | null, rows: number, items: { caption?: string; label: string }[]) => {
    const row = doc.createElement("div");
    row.className = "lesson-answer-row";
    for (const item of items) {
      if (item.caption) {
        const caption = doc.createElement("p");
        caption.className = "lesson-answer-caption";
        caption.textContent = item.caption;
        row.appendChild(caption);
      }
      const field = makeTextarea(rows);
      field.className = "lesson-field lesson-answer";
      row.appendChild(field);
      bind(field, nextKey("ans"), item.label);
    }
    if (after) after.insertAdjacentElement("afterend", row);
    else container.appendChild(row);
  };
  const addAnswer = (after: Element | null, rows: number, label: string) => addAnswers(after, rows, [{ label }]);

  // Numbered prompts ("1. What is the correct immediate response?") each get an answer box.
  const prompts = Array.from(container.querySelectorAll(":scope > p")).filter(
    (p) => /^\d+[.)]\s*\S/.test(clean(p.textContent ?? "")) && !p.querySelector("input,textarea"),
  );
  // "For each mock file, complete the following tasks" is one list of tasks that applies to
  // several cases, so each task gets a box per case rather than one box shared between them.
  const first = prompts[0];
  const cases = first
    ? Array.from(container.querySelectorAll(":scope > h3, :scope > h4")).filter(
        (h) => h.compareDocumentPosition(first) & 4 /* DOCUMENT_POSITION_FOLLOWING */,
      )
    : [];
  const perCase = cases.length >= 2 && /^for each\b/i.test(clean(first?.previousElementSibling?.textContent ?? ""));

  for (const p of prompts) {
    const prompt = clean(p.textContent ?? "");
    if (perCase) {
      addAnswers(
        p,
        prompt.length <= 60 ? 1 : 2,
        cases.map((h) => {
          const title = clean(h.textContent ?? "");
          return { caption: title.split(/\s[—–-]\s/)[0], label: tidyLabel(`${title} — ${prompt}`) };
        }),
      );
      continue;
    }
    const context = promptContext(p);
    addAnswer(p, prompt.length <= 60 ? 1 : 3, tidyLabel(context ? `${context} — ${prompt}` : prompt));
  }

  // No numbered prompts: a list here is the thing being answered (an order to put things in,
  // points to identify), so one box under each list.
  if (prompts.length === 0) {
    for (const list of Array.from(container.querySelectorAll(":scope > ul, :scope > ol"))) {
      const context = promptContext(list);
      addAnswer(list, 4, tidyLabel(context ? `${context} — Your answer` : "Your answer"));
    }
  }

  // An answer section must never be left with nowhere to write.
  if (counters.cell + counters.blank + counters.box + counters.ans === 0) {
    addAnswer(container.lastElementChild, 4, "Your response");
  }
}
