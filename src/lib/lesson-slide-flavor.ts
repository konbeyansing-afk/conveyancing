/**
 * Chooses a presentation template for an existing lesson section, based only
 * on the section's own real title (itself a real H2 heading the author
 * wrote — see splitIntoSteps). This never changes or invents content, only
 * which card chrome/icon a section's already-rendered HTML sits inside.
 */
export type SlideFlavor =
  | "objectives"
  | "example"
  | "warning"
  | "tip"
  | "checklist"
  | "summary"
  | "content";

const RULES: Array<{ flavor: SlideFlavor; pattern: RegExp }> = [
  { flavor: "objectives", pattern: /learning objectives|you'?ll learn|what you'?ll learn/i },
  { flavor: "warning", pattern: /warning|important|caution/i },
  { flavor: "tip", pattern: /\btip\b|\bva tip\b/i },
  { flavor: "checklist", pattern: /checklist/i },
  { flavor: "summary", pattern: /key takeaways|summary|wrap[\s-]?up/i },
  { flavor: "example", pattern: /example|scenario/i },
];

export function classifySlideFlavor(title: string): SlideFlavor {
  for (const rule of RULES) {
    if (rule.pattern.test(title)) return rule.flavor;
  }
  return "content";
}
