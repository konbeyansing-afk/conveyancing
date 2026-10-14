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

/**
 * What the viewer reports when a trainee edits a field.
 *
 * `key` is the field's stable identity (see stableFieldKey): derived from what the
 * field asks, not from where it sits, so adding, removing or reordering other
 * questions never moves an answer. `legacyKey` is only present when this edit is
 * the first save of an answer that was stored under the old positional key, so the
 * server can re-key that row in place instead of leaving two copies.
 */
export type FieldChange = {
  key: string;
  legacyKey?: string;
  label: string;
  section: string;
  position: number;
  value: string;
};

/** A saved answer as the viewer receives it. `trusted` = known to belong to the field at its legacy position. */
export type SavedAnswer = { value: string; label?: string; trusted?: boolean };

export type FieldKind = "cell" | "blank" | "box" | "ans";

export type FieldDescriptor = {
  key: string;
  legacyKey: string;
  kind: FieldKind;
  label: string;
  section: string;
  position: number;
};

/** 53-bit string hash (cyrb53): deterministic and identical in the browser and in Node. */
function hash53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Ordinals ("1.", "3)", "7 ·") describe where something currently sits, so they are
 * left out of the identity: renumbering a list must not make its answers look new.
 * Digits that are part of a name ("Scenario 4", "Mock File 2") are kept.
 */
function normaliseForId(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/^\d+\s·\s/, "")
    .replace(/(^|\s-\s)\d+[.)]\s+/g, "$1");
}

/**
 * The stable identity of a field: a hash of its section, kind, the question it
 * asks, and which occurrence of that identical question it is. Nothing positional
 * is in it, so reordering or inserting other questions leaves it unchanged; editing
 * the question's own text changes it (the old answer is then kept and flagged
 * rather than silently attached to different wording).
 */
export function stableFieldKey(
  section: string,
  kind: string,
  label: string,
  occurrence: number,
  sectionOccurrence = 0,
): string {
  const input = [
    normaliseForId(section.replace(/^\d+[.)]\s*/, "")),
    String(sectionOccurrence),
    kind,
    normaliseForId(label),
    String(occurrence),
  ].join("\u241f");
  return `f-${hash53(input).toString(16).padStart(14, "0")}`;
}

export const STABLE_KEY = /^f-[0-9a-f]{14}$/;
export const LEGACY_KEY = /^s\d{1,3}-(cell|blank|box|ans)-\d{1,4}$/;

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
    /** The section's heading text; part of every field's stable identity. */
    stepTitle: string;
    /** How many earlier sections in the same lesson have this same heading (0 for the first). */
    stepOccurrence?: number;
    saved: Record<string, SavedAnswer>;
    onChange: (change: FieldChange) => void;
    /** The section is a written-answer one (see isAnswerStep): give its prompts somewhere to write. */
    answerStep?: boolean;
  },
): FieldDescriptor[] {
  const doc = container.ownerDocument;
  const counters = { cell: 0, blank: 0, box: 0, ans: 0 };
  const nextKey = (kind: keyof typeof counters) => `s${opts.stepIndex}-${kind}-${counters[kind]++}`;

  // Fields are registered as they are created and wired up together once the section
  // is complete: a stable identity needs to know how many identical questions exist.
  const registry: { el: HTMLInputElement | HTMLTextAreaElement; legacyKey: string; kind: FieldKind; label: string }[] = [];
  const bind = (el: HTMLInputElement | HTMLTextAreaElement, legacyKey: string, label: string) => {
    const kind = legacyKey.split("-")[1] as FieldKind;
    registry.push({ el, legacyKey, kind, label });
  };

  const finalize = (): FieldDescriptor[] => {
    const totals = new Map<string, number>();
    const slotOf = (r: (typeof registry)[number]) => `${r.kind}|${normaliseForId(r.label)}`;
    for (const r of registry) totals.set(slotOf(r), (totals.get(slotOf(r)) ?? 0) + 1);
    const seen = new Map<string, number>();

    return registry.map((r, position) => {
      const slot = slotOf(r);
      const occurrence = seen.get(slot) ?? 0;
      seen.set(slot, occurrence + 1);
      const key = stableFieldKey(opts.stepTitle, r.kind, r.label, occurrence, opts.stepOccurrence ?? 0);
      const unique = totals.get(slot) === 1;

      // Prefer the answer stored under this field's own identity. An answer still stored
      // under the old positional key is only adopted when it is known to belong here:
      // the lesson has not changed since it was saved, or it carries this very question
      // text and no other field in the section asks the same thing.
      let saved = opts.saved[key];
      let adopted: string | undefined;
      if (!saved) {
        const legacy = opts.saved[r.legacyKey];
        if (legacy && (legacy.trusted || (unique && legacy.label === r.label))) {
          saved = legacy;
          adopted = r.legacyKey;
        }
      }

      const { el, label } = r;
      el.setAttribute("aria-label", label || "Your answer");
      const report = (value: string) =>
        opts.onChange({ key, legacyKey: adopted, label, section: opts.stepTitle, position, value });
      if ((el as HTMLInputElement).type === "checkbox") {
        const box = el as HTMLInputElement;
        box.checked = saved?.value === "checked";
        box.addEventListener("change", () => report(box.checked ? "checked" : ""));
      } else {
        if (saved) el.value = saved.value;
        el.addEventListener("input", () => report(el.value));
      }
      return { key, legacyKey: r.legacyKey, kind: r.kind, label, section: opts.stepTitle, position };
    });
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

  if (!opts.answerStep) return finalize();

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

  return finalize();
}
