import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Layers,
  FileText,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  ClipboardCheck,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toggleCoursePublish, deleteCourse } from "@/lib/actions/courses";
import { deleteModule } from "@/lib/actions/modules";
import { deleteLesson, moveLessonOrder } from "@/lib/actions/lessons";
import { EditCourseDialog } from "@/components/admin/course-dialogs";
import {
  CreateModuleDialog,
  CreateLessonDialog,
  EditModuleDialog,
} from "@/components/admin/module-lesson-dialogs";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatCard } from "@/components/admin/stat-card";
import { CourseEnrollmentsCard } from "@/components/admin/course-enrollments-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { JSONContent } from "@tiptap/core";
import type { LessonType } from "@prisma/client";

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

function lessonSubtitle(lessonType: LessonType, estimatedMinutes: number | null) {
  const type = LESSON_TYPE_LABEL[lessonType];
  return estimatedMinutes ? `${type} · ${estimatedMinutes} min` : type;
}

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ programId: string; courseId: string }>;
}) {
  const { programId, courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      program: true,
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { quiz: { select: { id: true } } },
          },
        },
      },
    },
  });

  if (!course || course.programId !== programId) notFound();

  const lessonCount = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);

  const [enrollments, availableTrainees] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { role: "TRAINEE", enrollments: { none: { courseId } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const enrolledTrainees = enrollments.map((e) => ({
    enrollmentId: e.id,
    name: e.user.name,
    email: e.user.email,
    status: e.status,
    enrolledAt: e.enrolledAt.toISOString(),
  }));

  const publishAction = toggleCoursePublish.bind(null, programId, courseId, !course.isPublished);
  const deleteCourseAction = deleteCourse.bind(null, programId, courseId);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Breadcrumbs
          items={[
            { label: "Programs", href: "/admin/programs" },
            { label: course.program.title, href: `/admin/programs/${programId}` },
            { label: course.title },
          ]}
        />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{course.title}</h1>
              <StatusBadge isPublished={course.isPublished} />
            </div>
            {course.description && (
              <p className="max-w-2xl text-muted-foreground">{course.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EditCourseDialog
              programId={programId}
              courseId={course.id}
              title={course.title}
              description={course.description}
              order={course.order}
              isPublished={course.isPublished}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`/app/courses/${course.id}`} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink /> Preview
            </Button>
            <form action={publishAction}>
              <Button type="submit" variant={course.isPublished ? "outline" : "default"}>
                {course.isPublished ? "Unpublish" : "Publish"}
              </Button>
            </form>
            <DeleteConfirmDialog
              trigger={<Trash2 />}
              title={`Delete "${course.title}"?`}
              description="This permanently deletes the course along with all its modules and lessons. This cannot be undone."
              action={deleteCourseAction}
              confirmLabel="Delete course"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Modules" value={course.modules.length} icon={Layers} />
        <StatCard label="Lessons" value={lessonCount} icon={FileText} />
      </div>

      <CourseEnrollmentsCard
        programId={programId}
        courseId={courseId}
        enrolled={enrolledTrainees}
        available={availableTrainees}
      />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Modules</h2>
          <CreateModuleDialog programId={programId} courseId={courseId} />
        </div>

        {course.modules.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No modules yet"
            description="Add the first module to start structuring this course."
          />
        ) : (
          <div className="grid gap-3">
            {course.modules.map((module, i) => {
              const deleteModuleAction = deleteModule.bind(null, programId, courseId, module.id);

              return (
                <Collapsible key={module.id} defaultOpen>
                  <Card className="gap-0 overflow-hidden py-0">
                    <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                      <Badge variant="outline" className="mf-mono shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </Badge>
                      <CollapsibleTrigger className="group flex flex-1 items-center justify-between gap-2 text-left">
                        <div>
                          <p className="font-medium">{module.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
                      </CollapsibleTrigger>
                      <EditModuleDialog
                        programId={programId}
                        courseId={courseId}
                        moduleId={module.id}
                        title={module.title}
                        order={module.order}
                      />
                      <DeleteConfirmDialog
                        trigger={<Trash2 className="size-4" />}
                        title={`Delete module "${module.title}"?`}
                        description="This also deletes every lesson inside this module. This cannot be undone."
                        action={deleteModuleAction}
                        confirmLabel="Delete module"
                      />
                    </div>

                    <CollapsibleContent>
                      <div className="p-4">
                        {module.lessons.length === 0 ? (
                          <p className="py-1 text-sm text-muted-foreground">
                            No lessons yet — add one below.
                          </p>
                        ) : (
                          <div className="grid">
                            {module.lessons.map((lesson, li) => {
                              const deleteLessonAction = deleteLesson.bind(
                                null,
                                programId,
                                courseId,
                                module.id,
                                lesson.id
                              );
                              const moveUpAction = moveLessonOrder.bind(
                                null,
                                programId,
                                courseId,
                                module.id,
                                lesson.id,
                                "up"
                              );
                              const moveDownAction = moveLessonOrder.bind(
                                null,
                                programId,
                                courseId,
                                module.id,
                                lesson.id,
                                "down"
                              );
                              const written = hasContent(lesson.content);

                              return (
                                <div
                                  key={lesson.id}
                                  className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0"
                                >
                                  <div className="flex shrink-0 flex-col">
                                    <form action={moveUpAction}>
                                      <button
                                        type="submit"
                                        disabled={li === 0}
                                        className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                                        title="Move up"
                                      >
                                        <ChevronUp className="size-3.5" />
                                      </button>
                                    </form>
                                    <form action={moveDownAction}>
                                      <button
                                        type="submit"
                                        disabled={li === module.lessons.length - 1}
                                        className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                                        title="Move down"
                                      >
                                        <ChevronDown className="size-3.5" />
                                      </button>
                                    </form>
                                  </div>
                                  <Badge variant="outline" className="mf-mono shrink-0 justify-center">
                                    {String(li + 1).padStart(2, "0")}
                                  </Badge>
                                  {written ? (
                                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                                  ) : (
                                    <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <Link
                                      href={`/admin/programs/${programId}/courses/${courseId}/lessons/${lesson.id}`}
                                      className="block truncate text-sm font-medium hover:underline"
                                    >
                                      {lesson.title}
                                    </Link>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {lessonSubtitle(lesson.lessonType, lesson.estimatedMinutes)}
                                    </p>
                                  </div>
                                  {lesson.quiz && (
                                    <span title="Has a knowledge check">
                                      <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" />
                                    </span>
                                  )}
                                  <StatusBadge isPublished={lesson.isPublished} />
                                  <a
                                    href={`/app/courses/${courseId}/lessons/${lesson.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Preview as trainee"
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <ExternalLink className="size-4" />
                                  </a>
                                  <DeleteConfirmDialog
                                    trigger={<Trash2 className="size-4" />}
                                    title={`Delete lesson "${lesson.title}"?`}
                                    description="This also removes its knowledge check. This cannot be undone."
                                    action={deleteLessonAction}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-3">
                          <CreateLessonDialog
                            programId={programId}
                            courseId={courseId}
                            moduleId={module.id}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
