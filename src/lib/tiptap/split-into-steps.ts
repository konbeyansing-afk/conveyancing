import type { JSONContent } from "@tiptap/core";

export type LessonStep = {
  title: string;
  content: JSONContent;
};

function headingText(node: JSONContent): string {
  return (node.content ?? []).map((child) => child.text ?? "").join("");
}

/** Splits a lesson's Tiptap document into steps at each top-level H2 heading. */
export function splitIntoSteps(doc: JSONContent | null | undefined): LessonStep[] {
  const nodes = doc?.content ?? [];
  const steps: LessonStep[] = [];

  let current: JSONContent[] = [];
  let currentTitle = "Introduction";

  for (const node of nodes) {
    if (node.type === "heading" && node.attrs?.level === 2) {
      if (current.length > 0) {
        steps.push({ title: currentTitle, content: { type: "doc", content: current } });
      }
      currentTitle = headingText(node) || "Section";
      current = [node];
    } else {
      current.push(node);
    }
  }

  if (current.length > 0) {
    steps.push({ title: currentTitle, content: { type: "doc", content: current } });
  }

  return steps;
}
