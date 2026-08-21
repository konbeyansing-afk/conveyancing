/**
 * The two places where authored content becomes markup or a URL.
 *
 * Lesson content is rendered with dangerouslySetInnerHTML, so the safety
 * property that matters is that the HTML is produced by Tiptap's schema-driven
 * serializer from a fixed extension list — anything the schema does not know
 * about never reaches the page as markup. The embed node is the one place an
 * author-supplied string becomes an element attribute, so its allowlist is the
 * control being tested here.
 */

import { describe, expect, it } from "vitest";
import { isAllowedEmbedUrl } from "@/lib/tiptap/embed-extension";
import { lessonContentToHtml } from "@/components/lesson-content/lesson-content-html";
import { splitIntoSteps } from "@/lib/tiptap/split-into-steps";
import { slugify, uniqueSlug } from "@/lib/slugify";

describe("Embed URL allowlist", () => {
  it("accepts the video hosts the firm actually uses, over https", () => {
    for (const url of [
      "https://www.youtube.com/embed/abc123",
      "https://youtube.com/embed/abc123",
      "https://player.vimeo.com/video/12345",
      "https://www.loom.com/embed/abcdef",
    ]) {
      expect(isAllowedEmbedUrl(url), url).toBe(true);
    }
  });

  it("refuses anything else", () => {
    for (const url of [
      "http://www.youtube.com/embed/abc123", // not https
      "https://evil.example.com/embed",
      "https://youtube.com.evil.example.com/embed",
      "https://notyoutube.com/embed",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//www.youtube.com/embed/abc",
      "",
      "not a url at all",
    ]) {
      expect(isAllowedEmbedUrl(url), url).toBe(false);
    }
  });
});

describe("Lesson content rendering", () => {
  it("renders ordinary authored content", () => {
    const html = lessonContentToHtml({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    });
    expect(html).toContain("Hello");
    expect(html).toContain("<p>");
  });

  it("escapes text that looks like markup rather than emitting it", () => {
    const html = lessonContentToHtml({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "<script>alert('x')</script>" }],
        },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops an embed whose URL is not on the allowlist", () => {
    const html = lessonContentToHtml({
      type: "doc",
      content: [{ type: "embed", attrs: { src: "https://evil.example.com/x" } }],
    });
    expect(html).not.toContain("evil.example.com");
    expect(html).toContain("Invalid embed URL");
  });

  it("renders an allowlisted embed as an iframe", () => {
    const html = lessonContentToHtml({
      type: "doc",
      content: [{ type: "embed", attrs: { src: "https://player.vimeo.com/video/12345" } }],
    });
    expect(html).toContain("<iframe");
    expect(html).toContain("https://player.vimeo.com/video/12345");
  });

  it("returns nothing for empty content instead of throwing", () => {
    expect(lessonContentToHtml(null)).toBe("");
    expect(lessonContentToHtml(undefined)).toBe("");
  });
});

describe("Splitting a lesson into steps", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Intro copy" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "First" }] },
      { type: "paragraph", content: [{ type: "text", text: "First body" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Second" }] },
      { type: "paragraph", content: [{ type: "text", text: "Second body" }] },
    ],
  };

  it("splits at each top-level H2 and keeps content before the first one", () => {
    const steps = splitIntoSteps(doc);
    expect(steps.map((s) => s.title)).toEqual(["Introduction", "First", "Second"]);
  });

  it("keeps every node — nothing is dropped in the split", () => {
    const steps = splitIntoSteps(doc);
    const total = steps.reduce((n, s) => n + (s.content.content?.length ?? 0), 0);
    expect(total).toBe(doc.content.length);
  });

  it("returns a single step when there are no headings", () => {
    const steps = splitIntoSteps({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Just prose" }] }],
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].title).toBe("Introduction");
  });

  it("does not split on an H3", () => {
    const steps = splitIntoSteps({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Sub" }] },
        { type: "paragraph", content: [{ type: "text", text: "Body" }] },
      ],
    });
    expect(steps).toHaveLength(1);
  });

  it("returns no steps for an empty document", () => {
    expect(splitIntoSteps(null)).toEqual([]);
    expect(splitIntoSteps({ type: "doc", content: [] })).toEqual([]);
  });
});

describe("Slugs", () => {
  it("makes a URL-safe slug from a title", () => {
    expect(slugify("Opening a Matter — Introduction")).toBe("opening-a-matter-introduction");
    expect(slugify("  Trailing & leading  ")).toBe("trailing-leading");
    expect(slugify("Phase 4A — Queensland Process")).toBe("phase-4a-queensland-process");
  });

  it("never produces an empty slug", () => {
    // A title of punctuation or a non-Latin script used to reduce to "".
    for (const title of ["日本語", "!!!", "———", "🙂"]) {
      expect(slugify(title), title).not.toBe("");
    }
  });

  it("numbers a slug that is already taken rather than colliding", async () => {
    const taken = new Set(["opening-a-matter", "opening-a-matter-2"]);
    const slug = await uniqueSlug("Opening a Matter", async (s) => taken.has(s));
    expect(slug).toBe("opening-a-matter-3");
  });

  it("leaves a free slug alone", async () => {
    expect(await uniqueSlug("Brand New Lesson", async () => false)).toBe("brand-new-lesson");
  });
});
