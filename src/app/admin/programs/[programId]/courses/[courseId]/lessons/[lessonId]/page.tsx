import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { courseBelongsToProgram } from "@/lib/stage-access";
import {
  updateLessonContent,
  updateLessonTrainerNotes,
  deleteLesson,
  toggleLessonPublish,
} from "@/lib/actions/lessons";
import { splitIntoSteps } from "@/lib/tiptap/split-into-steps";
import { lessonContentToHtml } from "@/components/lesson-content/lesson-content-html";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { StatusBadge } from "@/components/admin/status-badge";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoverBanner } from "@/lib/cover-theme";
import { LessonBuilderShell } from "@/components/admin/lesson-builder/lesson-builder-shell";
import { LessonDetailsForm } from "@/components/admin/lesson-builder/lesson-details-form";
import { LessonContentStep } from "@/components/admin/lesson-builder/lesson-content-step";
import { LessonResourcesPanel } from "@/components/admin/lesson-builder/lesson-resources-panel";
import { LessonSettingsPanel } from "@/components/admin/lesson-builder/lesson-settings-panel";
import { LessonPreviewPanel } from "@/components/admin/lesson-builder/lesson-preview-panel";
import { LessonPublishStep } from "@/components/admin/lesson-builder/lesson-publish-step";
import { ModuleLessonNav } from "@/components/admin/lesson-builder/module-lesson-nav";
import { LessonQuickSettingsPanel } from "@/components/admin/lesson-builder/lesson-quick-settings-panel";
import { ExternalLink, Trash2 } from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import type { LessonType, Difficulty } from "@prisma/client";

function hasContent(content: unknown) {
  const doc = content as JSONContent | null;
  return !!doc?.content && doc.content.length > 0;
}

const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  STANDARD: "Standard",
  VIDEO: "Video",
  READING: "Reading",
  PRACTICAL: "Practical",
  QUIZ: "Quiz",
  ASSESSMENT: "Assessment",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export default async function AdminLessonDetailPage({
  params,
}: {
  params: Promise<{ programId: string; courseId: string; lessonId: string }>;
}) {
  const { programId, courseId, lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: {
          course: { include: { program: true, stage: { select: { programId: true } } } },
          lessons: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, estimatedMinutes: true, isPublished: true, content: true },
          },
        },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      quiz: {
        include: {
          questions: { orderBy: { order: "asc" }, include: { choices: { orderBy: { order: "asc" } } } },
        },
      },
    },
  });

  if (
    !lesson ||
    lesson.module.course.id !== courseId ||
    !courseBelongsToProgram(lesson.module.course, programId)
  ) {
    notFound();
  }

  const { program, ...course } = lesson.module.course;
  const contentIsWritten = hasContent(lesson.content);

  const missing: string[] = [];
  if (!lesson.title.trim()) missing.push("Lesson title");
  if (!contentIsWritten) missing.push("Lesson content");
  const readiness = { ok: missing.length === 0, missing };

  const saveContent = updateLessonContent.bind(null, programId, courseId, lessonId);
  const saveTrainerNotes = updateLessonTrainerNotes.bind(null, programId, courseId, lessonId);
  const deleteLessonAction = deleteLesson.bind(null, programId, courseId, lesson.moduleId, lessonId);
  const publishAction = toggleLessonPublish.bind(null, programId, courseId, lessonId, true);
  const unpublishAction = toggleLessonPublish.bind(null, programId, courseId, lessonId, false);

  const rawSteps = splitIntoSteps(lesson.content as JSONContent | null);
  const previewSteps = rawSteps.map((s) => ({ title: s.title, html: lessonContentToHtml(s.content) }));

  const siblingLessons = lesson.module.lessons.map((l) => ({
    id: l.id,
    title: l.title,
    estimatedMinutes: l.estimatedMinutes,
    isPublished: l.isPublished,
    hasContent: hasContent(l.content),
  }));

  return (
    <div className="grid min-w-0 gap-4">
      <Breadcrumbs
        items={[
          { label: "Programs", href: "/admin/programs" },
          { label: program.title, href: `/admin/programs/${programId}` },
          { label: course.title, href: `/admin/programs/${programId}/courses/${courseId}` },
          { label: lesson.module.title },
          { label: lesson.title },
        ]}
      />

      <Card>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <CoverBanner
              title={lesson.title || "Lesson"}
              className="size-12 shrink-0 rounded-xl"
            />
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{lesson.title || "New Lesson"}</h1>
                <StatusBadge isPublished={lesson.isPublished} />
              </div>
              {lesson.description && (
                <p className="max-w-2xl text-muted-foreground">{lesson.description}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground">{LESSON_TYPE_LABEL[lesson.lessonType]}</strong> Type
                </span>
                <span>
                  <strong className="text-foreground">{DIFFICULTY_LABEL[lesson.difficulty]}</strong> Level
                </span>
                {lesson.estimatedMinutes ? (
                  <span>
                    <strong className="text-foreground">{lesson.estimatedMinutes}</strong> min
                  </span>
                ) : null}
                <span>
                  <strong className="text-foreground">{rawSteps.length}</strong>{" "}
                  {rawSteps.length === 1 ? "Step" : "Steps"}
                </span>
                <span>
                  <strong className="text-foreground">{lesson.quiz ? "Yes" : "No"}</strong> Knowledge check
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`/app/courses/${courseId}/lessons/${lessonId}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink /> Preview
            </Button>
            <form action={lesson.isPublished ? unpublishAction : publishAction}>
              <Button type="submit" variant={lesson.isPublished ? "outline" : "default"}>
                {lesson.isPublished ? "Unpublish" : "Publish"}
              </Button>
            </form>
            <DeleteConfirmDialog
              trigger={<Trash2 />}
              triggerVariant="ghost"
              title={`Delete "${lesson.title}"?`}
              description="This also removes its knowledge check and resources. This cannot be undone."
              action={deleteLessonAction}
              confirmLabel="Delete lesson"
            />
          </div>
        </div>
      </Card>

      <LessonBuilderShell
        isPublished={lesson.isPublished}
        detailsDone={lesson.title.trim().length > 0}
        contentDone={contentIsWritten}
        detailsSlot={
          <LessonDetailsForm
            programId={programId}
            courseId={courseId}
            lessonId={lessonId}
            title={lesson.title}
            description={lesson.description}
            lessonType={lesson.lessonType}
            difficulty={lesson.difficulty}
            estimatedMinutes={lesson.estimatedMinutes}
            hasContent={contentIsWritten}
          />
        }
        contentSlot={
          <div className="grid items-start gap-4 lg:grid-cols-[220px_1fr_260px]">
            <div className="lg:sticky lg:top-32">
              <ModuleLessonNav
                programId={programId}
                courseId={courseId}
                moduleTitle={lesson.module.title}
                lessons={siblingLessons}
                currentLessonId={lessonId}
              />
            </div>
            <LessonContentStep
              content={lesson.content as JSONContent | null}
              trainerNotes={lesson.trainerNotes as JSONContent | null}
              saveContent={saveContent}
              saveTrainerNotes={saveTrainerNotes}
            />
            <div className="lg:sticky lg:top-32">
              <LessonQuickSettingsPanel
                programId={programId}
                courseId={courseId}
                lessonId={lessonId}
                title={lesson.title}
                description={lesson.description}
                lessonType={lesson.lessonType}
                difficulty={lesson.difficulty}
                estimatedMinutes={lesson.estimatedMinutes}
                completionRequirement={lesson.completionRequirement}
                hasQuiz={!!lesson.quiz}
                isPublished={lesson.isPublished}
                readiness={readiness}
                publishAction={publishAction}
              />
            </div>
          </div>
        }
        resourcesSlot={
          <LessonResourcesPanel
            programId={programId}
            courseId={courseId}
            lessonId={lessonId}
            attachments={lesson.attachments}
          />
        }
        settingsSlot={
          <LessonSettingsPanel
            programId={programId}
            courseId={courseId}
            lessonId={lessonId}
            quiz={lesson.quiz}
          />
        }
        previewSlot={
          <LessonPreviewPanel
            steps={previewSteps}
            lessonTitle={lesson.title}
            moduleTitle={lesson.module.title}
            quizHref={lesson.quiz ? `/app/courses/${courseId}/lessons/${lessonId}/quiz` : undefined}
            isPublished={lesson.isPublished}
            resources={lesson.attachments}
          />
        }
        publishSlot={
          <LessonPublishStep
            isPublished={lesson.isPublished}
            hasTitle={lesson.title.trim().length > 0}
            hasDescription={!!lesson.description?.trim()}
            hasContent={contentIsWritten}
            hasDuration={!!lesson.estimatedMinutes}
            unpublishAction={unpublishAction}
            publishAction={publishAction}
          />
        }
      />
    </div>
  );
}
