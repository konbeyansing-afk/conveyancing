import { generateHTML } from "@tiptap/html/server";
import type { JSONContent } from "@tiptap/core";
import { tiptapExtensions } from "@/lib/tiptap/extensions";

export function lessonContentToHtml(content: JSONContent | null | undefined) {
  if (!content) return "";
  return generateHTML(content, tiptapExtensions);
}

export function LessonContentHtml({
  content,
  className,
}: {
  content: JSONContent | null | undefined;
  className?: string;
}) {
  const html = lessonContentToHtml(content);

  if (!html) return null;

  return (
    <div
      className={`lesson-content ${className ?? ""}`}
      // Content is authored only by ADMIN/TRAINER accounts through our own editor, not
      // arbitrary end-user input, so rendering the generated HTML directly is safe here.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
