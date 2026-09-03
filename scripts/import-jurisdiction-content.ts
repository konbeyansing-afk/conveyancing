/**
 * One-off / re-runnable importer: turns the NSW / VIC / UK Word-doc curricula
 * (pre-converted to HTML with pandoc) into structured Programs in the LMS,
 * organised into a normalised stage framework.
 *
 *   node --import tsx scripts/import-jurisdiction-content.ts            # dry run: prints the tree, writes nothing
 *   node --import tsx scripts/import-jurisdiction-content.ts --apply    # writes to the database
 *
 * Input: a directory of pandoc HTML exports of the source .docx files, laid
 * out as <root>/{nsw,vic,uk}/<file>.html. Point at it with JURISDICTION_HTML_DIR
 * (falls back to ./jurisdiction-content/html). Produce it with, e.g.:
 *   for f in "NSW"/*.docx; do pandoc "$f" -t html5 --wrap=none \
 *     -o "$JURISDICTION_HTML_DIR/nsw/$(basename "$f" .docx).html"; done
 *
 * Safe to re-run: on --apply each of the three target programs is deleted by
 * slug (cascades to its own stages/courses/modules/lessons) and rebuilt. No
 * other program, user, enrolment or progress row is touched. The three
 * programs are imported as DRAFT (Program.isPublished = false); their
 * stages/courses/lessons are marked published so that publishing the program
 * later reveals the whole tree at once.
 *
 * Env: reads .env for DATABASE_URL (Neon). Run from the repo root.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { generateJSON } from "@tiptap/html/server";
import { PrismaClient, type LessonType } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { tiptapExtensions } from "@/lib/tiptap/extensions";
import { slugify } from "@/lib/slugify";

try { process.loadEnvFile(".env"); } catch { /* rely on env */ }
neonConfig.webSocketConstructor = ws;

// happy-dom's Element/Node types don't structurally match lib.dom's globals
// (no layout props). This is a build script that only walks the tree, so we
// deliberately shadow the global with a loose alias for the rest of the file.
type Element = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const HTML_ROOT = process.env.JURISDICTION_HTML_DIR ?? join(process.cwd(), "jurisdiction-content", "html");
const REPORT_PATH = process.env.JURISDICTION_REPORT ?? join(HTML_ROOT, "..", "import-tree.txt");

const APPLY = process.argv.includes("--apply");

/* ------------------------------------------------------------------ config */

type ParseMode = "heading" | "bold";

interface PhaseSpec {
  file: string;
  phaseTitle: string;
  stage: string;
  parse: ParseMode;
}

interface JurisdictionSpec {
  code: string;
  programSlug: string;
  programTitle: string;
  programDescription: string;
  dir: string;
  stages: string[];
  phases: PhaseSpec[];
}

const AU_STAGES = (state: string) => [
  "Foundation",
  "Conveyancing Fundamentals",
  `${state} Process`,
  "Contracts",
  "Searches",
  "Pre-Settlement",
  "Settlement",
  "Post-Settlement",
  "Software & Systems",
  "Practical Simulations",
  "Final Assessment",
];

const NSW: JurisdictionSpec = {
  code: "NSW",
  programSlug: "nsw-conveyancing-va-academy",
  programTitle: "NSW Conveyancing VA Academy",
  programDescription:
    "Virtual Assistant training for New South Wales conveyancing practices. Administrative and operational support only — not legal advice.",
  dir: "nsw",
  stages: AU_STAGES("NSW"),
  phases: [
    { file: "Phase1_Program_Architecture_Governance_Framework", phaseTitle: "Program Architecture & Governance Framework", stage: "Foundation", parse: "bold" },
    { file: "Phase2_Legal_Compliance_Risk_Awareness", phaseTitle: "Legal, Compliance & Risk Awareness", stage: "Foundation", parse: "bold" },
    { file: "Phase3_NSW_Conveyancing_Fundamentals", phaseTitle: "NSW Conveyancing Fundamentals", stage: "Conveyancing Fundamentals", parse: "bold" },
    { file: "Phase4_NSW_Contract_for_Sale", phaseTitle: "NSW Contract for Sale", stage: "Contracts", parse: "bold" },
    { file: "Phase5_NSW_PreExchange_Process", phaseTitle: "NSW Pre-Exchange Process", stage: "NSW Process", parse: "bold" },
    { file: "Phase6_NSW_Searches_Property_Investigations", phaseTitle: "NSW Searches & Property Investigations", stage: "Searches", parse: "bold" },
    { file: "Phase7_Exchange_CoolingOff", phaseTitle: "Exchange & Cooling-Off", stage: "NSW Process", parse: "bold" },
    { file: "Phase8_PostExchange_PreSettlement", phaseTitle: "Post-Exchange & Pre-Settlement", stage: "Pre-Settlement", parse: "bold" },
    { file: "Phase9_PEXA_Electronic_Settlement", phaseTitle: "PEXA & Electronic Settlement", stage: "Settlement", parse: "bold" },
    { file: "Phase10_NSW_Settlement_Day", phaseTitle: "NSW Settlement Day", stage: "Settlement", parse: "bold" },
    { file: "Phase11_PostSettlement", phaseTitle: "Post-Settlement", stage: "Post-Settlement", parse: "bold" },
    { file: "Phase12_NSW_Strata_Conveyancing", phaseTitle: "NSW Strata Conveyancing", stage: "NSW Process", parse: "bold" },
    { file: "Phase13_Software_Practice_Management", phaseTitle: "Software & Practice Management", stage: "Software & Systems", parse: "bold" },
    { file: "Phase14_Conveyancing_VA_Data_Entry", phaseTitle: "Conveyancing VA Data Entry", stage: "Software & Systems", parse: "bold" },
    { file: "Phase15_Email_Communication_Laboratory", phaseTitle: "Email Communication Laboratory", stage: "Software & Systems", parse: "bold" },
    { file: "Phase16_Workflow_Simulator", phaseTitle: "NSW Conveyancing Workflow Simulator", stage: "Practical Simulations", parse: "bold" },
    { file: "Phase17_Error_RedFlag_Training", phaseTitle: "Error & Red-Flag Training", stage: "Practical Simulations", parse: "bold" },
    { file: "Phase18_Practical_Case_Studies", phaseTitle: "Practical Case Studies", stage: "Practical Simulations", parse: "bold" },
    { file: "Phase19_Final_Competency_Assessment", phaseTitle: "Final Competency Assessment", stage: "Final Assessment", parse: "bold" },
    { file: "Phase20_Shadowing", phaseTitle: "Shadowing", stage: "Final Assessment", parse: "bold" },
    { file: "Phase21_Production_Readiness", phaseTitle: "Production Readiness", stage: "Final Assessment", parse: "bold" },
  ],
};

const VIC: JurisdictionSpec = {
  code: "VIC",
  programSlug: "victoria-conveyancing-va-academy",
  programTitle: "Victoria Conveyancing VA Academy",
  programDescription:
    "Virtual Assistant training for Victorian conveyancing practices. Administrative and operational support only — not legal advice.",
  dir: "vic",
  stages: AU_STAGES("Victorian"),
  // VIC ships as 6 volume files, each containing several PHASE-VIC-NN sections.
  // We parse each volume once and route its phases by the map below.
  phases: [
    { file: "Victoria_Conveyancing_VA_Academy_Volume_A", phaseTitle: "__VOLUME__", stage: "Foundation", parse: "heading" },
    { file: "Victoria_Conveyancing_VA_Academy_Volume_B", phaseTitle: "__VOLUME__", stage: "Victorian Process", parse: "heading" },
    { file: "Victoria_Conveyancing_VA_Academy_Volume_C", phaseTitle: "__VOLUME__", stage: "Contracts", parse: "heading" },
    { file: "Victoria_Conveyancing_VA_Academy_Volume_D", phaseTitle: "__VOLUME__", stage: "Software & Systems", parse: "heading" },
    { file: "Victoria_Conveyancing_VA_Academy_Volume_E", phaseTitle: "__VOLUME__", stage: "Practical Simulations", parse: "heading" },
    { file: "Victoria_Conveyancing_VA_Academy_Volume_F", phaseTitle: "__VOLUME__", stage: "Final Assessment", parse: "heading" },
  ],
};

// VIC phase-number -> normalised stage. Non-PHASE trailing sections in Vol F
// (Master Checklists, Escalation Matrix, ...) route to Foundation as reference.
const VIC_PHASE_STAGE: Record<string, string> = {
  FRONT: "Foundation",
  "01": "Foundation",
  "02": "Conveyancing Fundamentals",
  "03": "Victorian Process",
  "04": "Victorian Process",
  "05": "Victorian Process",
  "06": "Contracts",
  "07": "Pre-Settlement",
  "08": "Searches",
  "09": "Settlement",
  "10": "Software & Systems",
  "11": "Software & Systems",
  "12": "Software & Systems",
  "13": "Pre-Settlement",
  "14": "Pre-Settlement",
  "15": "Practical Simulations",
  "16": "Practical Simulations",
  "17": "Final Assessment",
  "18": "Final Assessment",
  "19": "Final Assessment",
  "20": "Final Assessment",
  EXTRA: "Foundation",
};

const UK: JurisdictionSpec = {
  code: "UK",
  programSlug: "uk-conveyancing-va-academy",
  programTitle: "UK Conveyancing VA Academy (England & Wales)",
  programDescription:
    "Virtual Assistant training for England & Wales conveyancing practices. Administrative and operational support only — not legal advice. Does not cover Scotland or Northern Ireland.",
  dir: "uk",
  stages: [
    "Foundation",
    "Conveyancing Fundamentals",
    "UK Process",
    "Contracts",
    "Searches",
    "Pre-Exchange",
    "Exchange",
    "Completion",
    "Post-Completion",
    "Software & Systems",
    "Practical Simulations",
    "Final Assessment",
  ],
  phases: [
    { file: "00 - Course Overview", phaseTitle: "Course Overview", stage: "Foundation", parse: "heading" },
    { file: "16 - Client Onboarding and Compliance", phaseTitle: "Client Onboarding & Compliance", stage: "Foundation", parse: "heading" },
    { file: "18 - What a Conveyancing VA Does", phaseTitle: "What a Conveyancing VA Does", stage: "Foundation", parse: "heading" },
    { file: "01 - Introduction to UK Conveyancing", phaseTitle: "Introduction to UK Conveyancing", stage: "Conveyancing Fundamentals", parse: "heading" },
    { file: "02 - Types of Property Ownership", phaseTitle: "Types of Property Ownership", stage: "Conveyancing Fundamentals", parse: "heading" },
    { file: "03 - Who Is Involved", phaseTitle: "Who Is Involved", stage: "Conveyancing Fundamentals", parse: "heading" },
    { file: "20 - UK Conveyancing Dictionary", phaseTitle: "UK Conveyancing Dictionary", stage: "Conveyancing Fundamentals", parse: "heading" },
    { file: "04 - Selling a Property", phaseTitle: "Selling a Property", stage: "UK Process", parse: "heading" },
    { file: "05 - Buying a Property", phaseTitle: "Buying a Property", stage: "UK Process", parse: "heading" },
    { file: "21 - End-to-End Workflow", phaseTitle: "End-to-End Workflow", stage: "UK Process", parse: "heading" },
    { file: "06 - Important Conveyancing Documents", phaseTitle: "Important Conveyancing Documents", stage: "Contracts", parse: "heading" },
    { file: "08 - Pre-Contract Enquiries", phaseTitle: "Pre-Contract Enquiries", stage: "Pre-Exchange", parse: "heading" },
    { file: "13 - Mortgage Transactions", phaseTitle: "Mortgage Transactions", stage: "Pre-Exchange", parse: "heading" },
    { file: "09 - Exchange of Contracts", phaseTitle: "Exchange of Contracts", stage: "Exchange", parse: "heading" },
    { file: "11 - After Completion", phaseTitle: "After Completion", stage: "Post-Completion", parse: "heading" },
    { file: "14 - Stamp Duty Land Tax", phaseTitle: "Stamp Duty Land Tax", stage: "Post-Completion", parse: "heading" },
    { file: "15 - HM Land Registry", phaseTitle: "HM Land Registry", stage: "Post-Completion", parse: "heading" },
    { file: "17 - Matter Management Software", phaseTitle: "Matter Management Software", stage: "Software & Systems", parse: "heading" },
    { file: "19 - UK Professional Communication", phaseTitle: "UK Professional Communication", stage: "Software & Systems", parse: "heading" },
    { file: "22 - Common Conveyancing Issues", phaseTitle: "Common Conveyancing Issues", stage: "Practical Simulations", parse: "heading" },
    { file: "23 - Practical Case Studies", phaseTitle: "Practical Case Studies", stage: "Practical Simulations", parse: "heading" },
    { file: "24 - Practical VA Checklists", phaseTitle: "Practical VA Checklists", stage: "Practical Simulations", parse: "heading" },
  ],
};

/* ------------------------------------------------------ parsing utilities */

const NSW_SECTIONS = new Set(
  [
    "what you will learn", "what you'll learn", "why it matters", "key concepts",
    "nsw-specific knowledge", "step-by-step workflow", "step by step workflow",
    "va responsibilities", "what the va must not do", "common mistakes", "red flags",
    "when to escalate", "practical example", "practice activity", "knowledge check",
    "competency task",
  ].map((s) => s.toLowerCase()),
);

const _VIC_SECTIONS = new Set(
  [
    "learning objective", "why this matters", "victorian conveyancing context",
    "plain-english explanation", "plain english explanation", "step-by-step workflow",
    "va responsibilities", "conveyancer/solicitor responsibilities",
    "va responsibilities vs conveyancer/solicitor responsibilities",
    "documents used", "systems used", "documents & systems used",
    "important dates/deadlines", "common mistakes", "red flags",
    "common mistakes & red flags", "escalation rules", "worked example",
    "practice exercise", "practice exercises", "simulation", "knowledge check",
    "practical assessment", "competency standard", "production application",
    "official sources", "last verified date", "examples",
  ].map((s) => s.toLowerCase()),
);

const BOILERPLATE =
  /conveyancing va academy|^important notice|read before use|training scope disclaimer|how to use this document|^version \d|last reviewed:|prepared for:|companion .*framework|placeholders? .*should be bound/i;

interface ParsedLesson {
  title: string;
  description: string;
  bodyHtml: string;
}
interface ParsedPhase {
  phaseTitle: string;
  stage: string;
  lessons: ParsedLesson[];
}

function makeDoc(html: string) {
  const win = new Window({ settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  win.document.body.innerHTML = html;
  return win.document;
}

function textOf(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A <p> whose entire content is a single <strong> (a pandoc-rendered bold heading). */
function boldHeading(el: Element): string | null {
  if (el.tagName !== "P") return null;
  const kids = [...el.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent?.trim()));
  if (kids.length === 1 && (kids[0] as Element).tagName === "STRONG") return textOf(el);
  return null;
}

function firstSentence(html: string): string {
  const t = (makeDoc(html).body.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = t.match(/^.{20,220}?[.!?](\s|$)/);
  return (m ? m[0] : t.slice(0, 200)).trim();
}

function isJunkTitle(raw: string): boolean {
  const t = raw.replace(/\s*\{#.*$/, "").trim().toLowerCase();
  return (
    t.length < 3 ||
    /^(table of contents|important notice|exercises?|master training program.*|conveyancing va academy.*)$/.test(t) ||
    /^(nsw|victoria|uk) conveyancing va academy$/.test(t) ||
    /^module \d+\s*[:—–-]/.test(t)
  );
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/^\[?(?:PHASE|MODULE|LESSON|ASSESSMENT|SIM)-[A-Z]+-[0-9-]+\]?\s*[—–-]*\s*/i, "")
    .replace(/^\d+(\.\d+)*[.:) ]\s*/, "")
    .replace(/^(Lesson|Module|Stage|Phase|Scenario|Case Study|Checklist)\s+[\d.]+\s*(of\s+\d+)?\s*[—–:-]*\s*/i, "")
    .replace(/\s*\{#.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise a lesson's body: promote sub-headings + bold section labels to <h2>. */
function normaliseBody(elements: Element[]): string {
  const out: string[] = [];
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      out.push(`<h2>${escapeHtml(cleanTitleKeepNumber(textOf(el)))}</h2>`);
      continue;
    }
    const bh = boldHeading(el);
    if (bh) {
      // "1. Learning Objective  rest of paragraph text" -> heading + paragraph
      const m = bh.match(/^(\d{1,2}\.\s*)?(.+?)(?:\s{2,}|\s—\s|:\s)(.*)$/);
      const label = (m ? m[2] : bh).trim();
      const rest = m && m[3] ? m[3].trim() : "";
      out.push(`<h2>${escapeHtml(label)}</h2>`);
      if (rest) out.push(`<p>${escapeHtml(rest)}</p>`);
      continue;
    }
    out.push(el.outerHTML);
  }
  return out.join("\n");
}
function cleanTitleKeepNumber(raw: string) {
  return raw.replace(/\s*\{#.*$/, "").replace(/\s+/g, " ").trim();
}
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* --------------------------------------------------------- heading parser */

function parseHeadingFile(html: string, defaultPhaseTitle: string, forcePhaseTitle = false): ParsedPhase[] {
  const doc = makeDoc(html);
  const nodes = [...doc.body.children] as Element[];

  // Drop a leading "Table of Contents" heading + its list.
  const headings = nodes.filter((n) => /^H[1-6]$/.test(n.tagName) && !/^table of contents$/i.test(textOf(n)));
  const levels = [...new Set(headings.map((h) => Number(h.tagName[1])))].sort((a, b) => a - b);
  if (levels.length === 0) {
    return [{ phaseTitle: defaultPhaseTitle, stage: "", lessons: wholeAsOneLesson(nodes, defaultPhaseTitle) }];
  }
  const phaseLevel = levels[0];
  // Lesson level = the shallowest heading level deeper than the phase heading
  // that actually repeats (a real lesson tier always occurs ≥2 times). This
  // ignores a lone trailing deep heading like "Assessment Reference" and also
  // ignores the per-lesson section headings one level further down.
  const deeper = levels.filter((l) => l > phaseLevel);
  const countAt = (l: number) => headings.filter((h) => Number(h.tagName[1]) === l).length;
  const lessonLevel =
    deeper.find((l) => countAt(l) >= 2) ?? deeper[0] ?? phaseLevel + 1;

  const phases: ParsedPhase[] = [];
  let curPhase: ParsedPhase | null = null;
  let curLesson: { title: string; els: Element[] } | null = null;
  let seenLessonInPhase = false;
  const flushLesson = () => {
    if (curPhase && curLesson && curLesson.els.length) {
      const body = normaliseBody(curLesson.els);
      const title = cleanTitle(curLesson.title) || curLesson.title;
      if (body.replace(/<[^>]+>/g, "").trim().length > 0 && !isJunkTitle(title) && !isJunkTitle(curLesson.title)) {
        curPhase.lessons.push({ title, description: firstSentence(body), bodyHtml: body });
      }
    }
    curLesson = null;
  };
  const flushPhase = () => { flushLesson(); if (curPhase && curPhase.lessons.length) phases.push(curPhase); curPhase = null; seenLessonInPhase = false; };

  for (const el of nodes) {
    const tag = el.tagName;
    const lvl = /^H[1-6]$/.test(tag) ? Number(tag[1]) : 0;
    const t = textOf(el);
    if (lvl && lvl <= phaseLevel) {
      if (/^table of contents$/i.test(t)) continue;
      flushPhase();
      curPhase = { phaseTitle: forcePhaseTitle ? defaultPhaseTitle : cleanTitle(t) || t, stage: "", lessons: [] };
      continue;
    }
    if (!curPhase) { curPhase = { phaseTitle: cleanTitle(defaultPhaseTitle) || defaultPhaseTitle, stage: "", lessons: [] }; }
    if (lvl === lessonLevel) {
      flushLesson();
      if (isJunkTitle(cleanTitle(t)) || isJunkTitle(t) || BOILERPLATE.test(t)) { continue; }
      curLesson = { title: t, els: [] };
      seenLessonInPhase = true;
      continue;
    }
    if (!curLesson) {
      // Content before the first lesson -> an "Overview" lesson. Content
      // *after* the last lesson (trailing notices/exercises) is dropped.
      if (seenLessonInPhase) continue;
      curLesson = { title: "Overview", els: [] };
    }
    if (boldHeading(el) && BOILERPLATE.test(t)) continue;
    if (tag === "P" && BOILERPLATE.test(t)) continue;
    curLesson.els.push(el);
  }
  flushPhase();
  return phases;
}

function wholeAsOneLesson(nodes: Element[], title: string): ParsedLesson[] {
  const els = nodes.filter((n) => !(n.tagName === "P" && BOILERPLATE.test(textOf(n))));
  const body = normaliseBody(els);
  return body.trim() ? [{ title: cleanTitle(title) || title, description: firstSentence(body), bodyHtml: body }] : [];
}

/* ------------------------------------------------------------ bold parser */

function looksLikeSection(text: string, sectionSet: Set<string>): boolean {
  const m = text.match(/^\d{1,2}\.\s+(.+)$/);
  const label = (m ? m[1] : text).toLowerCase().replace(/[:.]+$/, "").trim();
  return sectionSet.has(label);
}

function parseBoldFile(html: string, phaseTitle: string, sectionSet: Set<string>): ParsedPhase {
  const doc = makeDoc(html);
  const nodes = [...doc.body.children] as Element[];
  const phase: ParsedPhase = { phaseTitle, stage: "", lessons: [] };

  // Identify lesson-heading indices.
  const isLessonHeading = (el: Element): string | null => {
    const bh = boldHeading(el) ?? (/^H[1-6]$/.test(el.tagName) ? textOf(el) : null);
    if (!bh) return null;
    if (looksLikeSection(bh, sectionSet)) return null;
    if (/^(\d{1,2}\.\s+.+|stage\s+\d+\s+of\s+\d+.*|scenario\s+\d+.*|case study\s+\d+.*|checklist\s+\d+.*|red flag\s+\d+.*|exercise\s+\d+.*)$/i.test(bh)) {
      if (BOILERPLATE.test(bh)) return null;
      return bh;
    }
    return null;
  };

  const lessonStarts: number[] = [];
  nodes.forEach((el, i) => { if (isLessonHeading(el)) lessonStarts.push(i); });

  if (lessonStarts.length === 0) {
    // No lesson structure (e.g. narrative simulator/shadowing phase): one lesson.
    const els = nodes.filter((n, i) => {
      const t = textOf(n);
      if (n.tagName === "TABLE" && i < 12) return false;
      if ((n.tagName === "P" || boldHeading(n)) && BOILERPLATE.test(t)) return false;
      return true;
    });
    const body = normaliseBody(els);
    if (body.trim()) phase.lessons.push({ title: phaseTitle, description: firstSentence(body), bodyHtml: body });
    return phase;
  }

  // Front matter -> Overview lesson (skip boilerplate + index table).
  const frontEls = nodes.slice(0, lessonStarts[0]).filter((n) => {
    const t = textOf(n);
    if (n.tagName === "TABLE") return false;
    if (/^(NSW|VICTORIA|UK) CONVEYANCING VA ACADEMY$/i.test(t)) return false;
    if (boldHeading(n) && BOILERPLATE.test(t)) return false;
    if (n.tagName === "P" && BOILERPLATE.test(t)) return false;
    if (boldHeading(n) && /^phase\s+\d+/i.test(t)) return false;
    return true;
  });
  const frontBody = normaliseBody(frontEls);
  if (frontBody.replace(/<[^>]+>/g, "").trim().length > 40) {
    phase.lessons.push({ title: "Overview", description: firstSentence(frontBody), bodyHtml: frontBody });
  }

  for (let k = 0; k < lessonStarts.length; k++) {
    const start = lessonStarts[k];
    const end = k + 1 < lessonStarts.length ? lessonStarts[k + 1] : nodes.length;
    const rawTitle = isLessonHeading(nodes[start])!;
    const bodyEls: Element[] = [];
    for (let i = start + 1; i < end; i++) {
      const el = nodes[i];
      if (boldHeading(el) && BOILERPLATE.test(textOf(el))) continue;
      bodyEls.push(el);
    }
    const body = normaliseBody(bodyEls);
    phase.lessons.push({
      title: cleanTitle(rawTitle) || rawTitle,
      description: firstSentence(body),
      bodyHtml: body,
    });
  }
  return phase;
}

/* ---------------------------------------------------------- VIC volume split */

function parseVicVolume(html: string): ParsedPhase[] {
  // Split the volume at every top-level <h1>; classify each block as PHASE-VIC-NN,
  // FRONT (before phase 1), or EXTRA (trailing non-PHASE h1 in Vol F).
  const doc = makeDoc(html);
  const nodes = [...doc.body.children] as Element[];
  type Block = { key: string; title: string; els: Element[] };
  const blocks: Block[] = [];
  let cur: Block | null = null;
  let seenPhase = false;
  for (const el of nodes) {
    if (el.tagName === "H1") {
      const t = textOf(el);
      if (/^table of contents$/i.test(t)) continue;
      const m = t.match(/PHASE-VIC-(\d+)/i);
      if (m) { seenPhase = true; cur = { key: m[1].padStart(2, "0"), title: cleanTitle(t) || t, els: [] }; blocks.push(cur); continue; }
      cur = { key: seenPhase ? "EXTRA" : "FRONT", title: cleanTitle(t) || t, els: [] };
      blocks.push(cur);
      continue;
    }
    if (!cur) cur = { key: "FRONT", title: "Program Guide", els: [] };
    if (blocks[blocks.length - 1] !== cur) blocks.push(cur);
    cur.els.push(el);
  }

  const phases: ParsedPhase[] = [];
  for (const b of blocks) {
    const stage = VIC_PHASE_STAGE[b.key] ?? "Foundation";
    const innerHtml = b.els.map((e) => e.outerHTML).join("\n");
    const parsed = parseHeadingFile(`<h1>${escapeHtml(b.title)}</h1>\n${innerHtml}`, b.title, b.key === "EXTRA");
    for (const p of parsed) {
      p.stage = stage;
      p.phaseTitle = b.key === "FRONT" ? "Program Guide" : b.key === "EXTRA" ? b.title : p.phaseTitle || b.title;
      if (p.lessons.length) phases.push(p);
    }
  }
  return phases;
}

/* --------------------------------------------------------- lesson typing */

function lessonType(stage: string, title: string): LessonType {
  const t = title.toLowerCase();
  if (stage === "Final Assessment" || /\bassessment\b|competency (task|assessment|matrix)/.test(t)) return "ASSESSMENT";
  if (stage === "Practical Simulations" || /simulation|simulator|case study|scenario/.test(t)) return "PRACTICAL";
  if (/overview|dictionary|glossary|checklist|reference|workflow$|shadowing|production readiness|official sources|update system/.test(t)) return "READING";
  return "STANDARD";
}

/* ----------------------------------------------------------------- build */

function contentJson(bodyHtml: string): unknown {
  try {
    const json = generateJSON(bodyHtml || "<p></p>", tiptapExtensions);
    if (!json || !Array.isArray(json.content) || json.content.length === 0) {
      return { type: "doc", content: [{ type: "paragraph" }] };
    }
    return json;
  } catch (e) {
    console.warn("  ! generateJSON failed:", (e as Error).message);
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
}

interface StageBuild {
  title: string;
  order: number;
  modules: { title: string; lessons: (ParsedLesson & { type: LessonType })[] }[];
}

function buildJurisdiction(spec: JurisdictionSpec) {
  const dir = join(HTML_ROOT, spec.dir);
  const available = new Set(readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")));

  const stageMap = new Map<string, StageBuild>();
  spec.stages.forEach((title, i) => stageMap.set(title, { title, order: i, modules: [] }));

  const collectPhase = (p: ParsedPhase, fallbackStage: string) => {
    const stageTitle = p.stage || fallbackStage;
    const sb = stageMap.get(stageTitle);
    if (!sb) { console.warn(`  ! unknown stage "${stageTitle}" for phase "${p.phaseTitle}"`); return; }
    const lessons = p.lessons
      .filter((l) => l.bodyHtml.replace(/<[^>]+>/g, "").trim().length > 0)
      .map((l) => ({ ...l, type: lessonType(stageTitle, l.title) }));
    if (lessons.length) sb.modules.push({ title: p.phaseTitle, lessons });
  };

  for (const ph of spec.phases) {
    if (!available.has(ph.file)) { console.warn(`  ! missing HTML: ${ph.file}`); continue; }
    const html = readFileSync(join(dir, `${ph.file}.html`), "utf8");
    if (spec.code === "VIC") {
      for (const p of parseVicVolume(html)) collectPhase(p, ph.stage);
    } else if (ph.parse === "bold") {
      const p = parseBoldFile(html, ph.phaseTitle, NSW_SECTIONS);
      collectPhase(p, ph.stage);
    } else {
      for (const p of parseHeadingFile(html, ph.phaseTitle, true)) collectPhase(p, ph.stage);
    }
  }
  // Merge modules that share a title within a stage (e.g. VIC "Program Guide"
  // appearing in two volumes).
  for (const sb of stageMap.values()) {
    const merged = new Map<string, StageBuild["modules"][number]>();
    for (const m of sb.modules) {
      const existing = merged.get(m.title);
      if (existing) existing.lessons.push(...m.lessons);
      else merged.set(m.title, { title: m.title, lessons: [...m.lessons] });
    }
    // Drop duplicate lessons (same title) inside each merged module.
    sb.modules = [...merged.values()].map((m) => {
      const seen = new Set<string>();
      return { title: m.title, lessons: m.lessons.filter((l) => { const k = l.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }) };
    });
  }
  return [...stageMap.values()].sort((a, b) => a.order - b.order);
}

/* ----------------------------------------------------------------- report */

function renderTree(spec: JurisdictionSpec, stages: StageBuild[]): string {
  const lines: string[] = [];
  let totalLessons = 0;
  lines.push(`\n${"═".repeat(78)}`);
  lines.push(`PROGRAM  ${spec.programTitle}   [${spec.programSlug}]  (draft)`);
  lines.push("═".repeat(78));
  for (const st of stages) {
    const n = st.modules.reduce((a, m) => a + m.lessons.length, 0);
    totalLessons += n;
    lines.push(`\n  STAGE ${String(st.order + 1).padStart(2)}  ${st.title}${n === 0 ? "   — not yet developed" : `   (${n} lessons)`}`);
    for (const m of st.modules) {
      lines.push(`      MODULE  ${m.title}  (${m.lessons.length})`);
      for (const l of m.lessons) lines.push(`          • [${l.type}] ${l.title}`);
    }
  }
  lines.push(`\n  → ${stages.length} stages, ${stages.filter((s) => s.modules.length).length} with content, ${totalLessons} lessons`);
  return lines.join("\n");
}

/* -------------------------------------------------------------- db apply */

async function applyJurisdiction(prisma: PrismaClient, spec: JurisdictionSpec, stages: StageBuild[]) {
  await prisma.program.deleteMany({ where: { slug: spec.programSlug } });
  const program = await prisma.program.create({
    data: { slug: spec.programSlug, title: spec.programTitle, description: spec.programDescription, isPublished: false },
  });

  let prevNonEmptyStageId: string | null = null;
  for (const st of stages) {
    const hasContent = st.modules.some((m) => m.lessons.length);
    const createdStage = await prisma.stage.create({
      data: {
        programId: program.id,
        slug: slugify(st.title),
        title: st.title,
        order: st.order,
        isPublished: hasContent,
        prerequisiteStageId: prevNonEmptyStageId,
        requireAllLessons: true,
      },
    });
    if (!hasContent) continue;
    const stageId: string = createdStage.id;
    prevNonEmptyStageId = stageId;

    const course = await prisma.course.create({
      data: {
        programId: program.id,
        stageId,
        slug: slugify(st.title),
        title: st.title,
        isPublished: true,
        order: 0,
      },
    });

    let moduleOrder = 0;
    for (const m of st.modules) {
      const mod = await prisma.module.create({
        data: { courseId: course.id, title: m.title, order: moduleOrder++ },
      });
      const usedSlugs = new Set<string>();
      let lessonOrder = 0;
      for (const l of m.lessons) {
        const base = slugify(l.title).slice(0, 60) || "lesson";
        let slug = base;
        let n = 2;
        while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
        usedSlugs.add(slug);
        await prisma.lesson.create({
          data: {
            moduleId: mod.id,
            slug,
            title: l.title.slice(0, 200),
            description: l.description.slice(0, 300) || null,
            lessonType: l.type,
            difficulty: "BEGINNER",
            isPublished: true,
            order: lessonOrder++,
            content: contentJson(l.bodyHtml) as object,
          },
        });
      }
    }
  }
  return program.id;
}

/* ------------------------------------------------------------------- main */

async function main() {
  const specs = [NSW, VIC, UK];
  const built = specs.map((s) => {
    console.log(`\nParsing ${s.code} …`);
    return { spec: s, stages: buildJurisdiction(s) };
  });

  const report = built.map(({ spec, stages }) => renderTree(spec, stages)).join("\n");
  console.log(report);
  writeFileSync(REPORT_PATH, report, "utf8");
  console.log(`\nTree written to ${REPORT_PATH}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to write to the database.");
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
  try {
    for (const { spec, stages } of built) {
      console.log(`\nApplying ${spec.code} …`);
      const id = await applyJurisdiction(prisma, spec, stages);
      console.log(`  ✓ ${spec.programTitle}  (program ${id})`);
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log("\nDone. Programs imported as DRAFT — review in /admin/programs, then publish.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
