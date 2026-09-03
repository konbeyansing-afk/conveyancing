"use client";

import { InteractiveLessonViewer } from "@/components/lesson-content/interactive-lesson-viewer";
import { matterFontVariables } from "@/lib/fonts";

async function noop() {
  return { ok: true } as const;
}

export function LessonPreviewPanel({
  steps,
  lessonTitle,
  moduleTitle,
  quizHref,
  isPublished,
  resources,
}: {
  steps: { title: string; html: string }[];
  lessonTitle: string;
  moduleTitle: string;
  quizHref?: string;
  isPublished: boolean;
  resources: { id: string; title: string; url: string; fileType: string }[];
}) {
  return (
    <div className={matterFontVariables}>
      <InteractiveLessonViewer
        steps={
          steps.length > 0
            ? steps
            : [{ title: lessonTitle, html: "<p>This lesson doesn&apos;t have content yet.</p>" }]
        }
        lessonTitle={lessonTitle}
        moduleTitle={moduleTitle}
        backHref="#preview"
        backLabel="Preview mode"
        onComplete={noop}
        quizHref={quizHref}
        isDraftPreview={!isPublished}
        resources={resources}
        embedded
      />
    </div>
  );
}
