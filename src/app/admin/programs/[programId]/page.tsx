import { notFound } from "next/navigation";
import { BookOpen, ChevronDown, ExternalLink, Lock, Pencil, ShieldCheck, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toggleProgramPublish, deleteProgram } from "@/lib/actions/programs";
import { toggleStagePublish, deleteStage, moveStageOrder } from "@/lib/actions/stages";
import { EditProgramDialog } from "@/components/admin/program-dialogs";
import { CreateStageDialog, EditStageDialog } from "@/components/admin/stage-dialogs";
import { StageApprovalsCard } from "@/components/admin/stage-approvals-card";
import { CreateCourseDialog } from "@/components/admin/course-dialogs";
import { CreateModuleDialog, CreateLessonDialog } from "@/components/admin/module-lesson-dialogs";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CoverBanner } from "@/lib/cover-theme";
import type { LessonType } from "@prisma/client";

const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  STANDARD: "Standard",
  VIDEO: "Video",
  READING: "Reading",
  PRACTICAL: "Practical",
  QUIZ: "Quiz",
  ASSESSMENT: "Assessment",
};

const courseWithModulesInclude = {
  modules: {
    orderBy: { order: "asc" as const },
    include: { lessons: { orderBy: { order: "asc" as const } } },
  },
  quizzes: { select: { id: true, title: true } },
  enrollments: { select: { userId: true } },
};

type CourseWithModules = {
  id: string;
  title: string;
  isPublished: boolean;
  modules: {
    id: string;
    title: string;
    lessons: {
      id: string;
      title: string;
      order: number;
      isPublished: boolean;
      estimatedMinutes: number | null;
      lessonType: LessonType;
    }[];
  }[];
};

export default async function AdminProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;

  const [program, completedProgress, trainees, stageApprovals] = await Promise.all([
    prisma.program.findUnique({
      where: { id: programId },
      include: {
        courses: { orderBy: { order: "asc" }, include: courseWithModulesInclude },
        stages: {
          orderBy: { order: "asc" },
          include: {
            prerequisiteStage: { select: { title: true, order: true } },
            courses: { orderBy: { order: "asc" }, include: courseWithModulesInclude },
          },
        },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { completedAt: { not: null } },
      select: { userId: true, lessonId: true },
    }),
    prisma.user.findMany({ where: { role: "TRAINEE" }, select: { id: true, name: true, email: true } }),
    prisma.stageApproval.findMany({
      where: { stage: { programId } },
      include: { user: { select: { name: true, email: true } }, approvedBy: { select: { name: true } } },
    }),
  ]);

  if (!program) notFound();

  const completedKeys = new Set(completedProgress.map((p) => `${p.userId}:${p.lessonId}`));
  const usesStages = program.stages.length > 0;
  const allCourses: CourseWithModules[] = usesStages
    ? program.stages.flatMap((s) => s.courses)
    : program.courses;

  const courseCount = allCourses.length;
  const moduleCount = allCourses.reduce((sum, c) => sum + c.modules.length, 0);
  const lessonCount = allCourses.reduce(
    (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.length, 0),
    0
  );

  const traineeIds = new Set<string>();
  let totalPossible = 0;
  let totalActual = 0;
  for (const course of allCourses as (CourseWithModules & { enrollments: { userId: string }[] })[]) {
    const publishedLessonIds = course.modules.flatMap((m) =>
      m.lessons.filter((l) => l.isPublished).map((l) => l.id)
    );
    const enrolledUserIds = course.enrollments.map((e) => e.userId);
    enrolledUserIds.forEach((id) => traineeIds.add(id));
    totalPossible += publishedLessonIds.length * enrolledUserIds.length;
    for (const userId of enrolledUserIds) {
      for (const lessonId of publishedLessonIds) {
        if (completedKeys.has(`${userId}:${lessonId}`)) totalActual++;
      }
    }
  }
  const avgCompletion = totalPossible > 0 ? Math.round((totalActual / totalPossible) * 100) : 0;

  const publishAction = toggleProgramPublish.bind(null, program.id, !program.isPublished);
  const deleteAction = deleteProgram.bind(null, program.id);
  const stageOptions = program.stages.map((s) => ({ id: s.id, title: s.title, order: s.order }));
  const approvalsByStage = new Map<string, typeof stageApprovals>();
  for (const approval of stageApprovals) {
    const list = approvalsByStage.get(approval.stageId) ?? [];
    list.push(approval);
    approvalsByStage.set(approval.stageId, list);
  }

  function renderCourses(courses: CourseWithModules[]) {
    return courses.map((course) => {
      const courseLessonCount = course.modules.reduce((s, m) => s + m.lessons.length, 0);
      return (
        <Card key={course.id} className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-primary uppercase">Course</p>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/programs/${program!.id}/courses/${course.id}`}
                  className="font-heading text-lg font-semibold hover:underline"
                >
                  {course.title}
                </Link>
                <StatusBadge isPublished={course.isPublished} />
              </div>
              <p className="text-sm text-muted-foreground">
                {course.modules.length} module{course.modules.length === 1 ? "" : "s"} ·{" "}
                {courseLessonCount} lesson{courseLessonCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/admin/programs/${program!.id}/courses/${course.id}`} />}
              >
                Manage Course
              </Button>
              <CreateModuleDialog programId={program!.id} courseId={course.id} />
            </div>
          </div>

          <div className="p-4">
            {course.modules.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                No modules yet — add one to start structuring this course.
              </p>
            ) : (
              <div className="grid gap-2">
                {course.modules.map((module, mi) => (
                  <Collapsible key={module.id} defaultOpen={mi === 0}>
                    <div className="rounded-lg border">
                      <CollapsibleTrigger className="group flex w-full items-center gap-3 px-3 py-2.5 text-left">
                        <Badge variant="secondary" className="size-6 shrink-0 justify-center rounded-full p-0">
                          {mi + 1}
                        </Badge>
                        <span className="flex-1 font-medium">{module.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-3 py-2">
                          {module.lessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className="flex items-center gap-3 border-b border-border/50 py-2 text-sm last:border-b-0"
                            >
                              <span className="w-7 shrink-0 text-xs text-muted-foreground">
                                L{lesson.order + 1}
                              </span>
                              <Link
                                href={`/admin/programs/${program!.id}/courses/${course.id}/lessons/${lesson.id}`}
                                className="min-w-0 flex-1 truncate font-medium text-primary hover:underline"
                              >
                                {lesson.title}
                              </Link>
                              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                                {lesson.estimatedMinutes
                                  ? `${lesson.estimatedMinutes} min`
                                  : LESSON_TYPE_LABEL[lesson.lessonType]}
                              </span>
                              <StatusBadge isPublished={lesson.isPublished} />
                              <Button
                                variant="outline"
                                size="sm"
                                nativeButton={false}
                                render={
                                  <Link
                                    href={`/admin/programs/${program!.id}/courses/${course.id}/lessons/${lesson.id}`}
                                  />
                                }
                              >
                                <Pencil /> Edit
                              </Button>
                            </div>
                          ))}
                          <div className="pt-2">
                            <CreateLessonDialog programId={program!.id} courseId={course.id} moduleId={module.id} />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </Card>
      );
    });
  }

  return (
    <div className="grid gap-6">
      <Breadcrumbs items={[{ label: "Programs", href: "/admin/programs" }, { label: program.title }]} />

      <Card>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <CoverBanner
              title={program.title}
              imageUrl={program.coverImageUrl}
              className="size-12 shrink-0 rounded-xl"
            />
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{program.title}</h1>
                <StatusBadge isPublished={program.isPublished} />
              </div>
              {program.description && (
                <p className="max-w-2xl text-muted-foreground">{program.description}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {usesStages && (
                  <span>
                    <strong className="text-foreground">{program.stages.length}</strong> Stages
                  </span>
                )}
                <span>
                  <strong className="text-foreground">{courseCount}</strong>{" "}
                  {courseCount === 1 ? "Course" : "Courses"}
                </span>
                <span>
                  <strong className="text-foreground">{moduleCount}</strong>{" "}
                  {moduleCount === 1 ? "Module" : "Modules"}
                </span>
                <span>
                  <strong className="text-foreground">{lessonCount}</strong>{" "}
                  {lessonCount === 1 ? "Lesson" : "Lessons"}
                </span>
                <span>
                  <strong className="text-foreground">{traineeIds.size}</strong> Trainees Enrolled
                </span>
                <span>
                  <strong className="text-primary">{avgCompletion}%</strong> Avg. Completion
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <EditProgramDialog
              programId={program.id}
              title={program.title}
              description={program.description}
              coverImageUrl={program.coverImageUrl}
              isPublished={program.isPublished}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="/app/courses" target="_blank" rel="noreferrer" />}
            >
              <ExternalLink /> Preview
            </Button>
            <form action={publishAction}>
              <Button type="submit" variant={program.isPublished ? "outline" : "default"}>
                {program.isPublished ? "Unpublish" : "Publish"}
              </Button>
            </form>
            <DeleteConfirmDialog
              trigger={<Trash2 />}
              triggerVariant="ghost"
              title={`Delete "${program.title}"?`}
              description="This permanently deletes the program along with all its stages, courses, modules, and lessons. This cannot be undone."
              action={deleteAction}
              confirmLabel="Delete program"
            />
          </div>
        </div>
      </Card>

      {usesStages ? (
        <div className="grid gap-4">
          {program.stages.map((stage, si) => {
            const approvals = (approvalsByStage.get(stage.id) ?? []).map((a) => ({
              approvalId: a.id,
              userId: a.userId,
              name: a.user.name,
              email: a.user.email,
              approvedAt: a.approvedAt.toISOString(),
              approvedByName: a.approvedBy.name,
            }));
            const quizOptions = stage.courses.flatMap((c) => c.quizzes ?? []);
            const publishStageAction = toggleStagePublish.bind(null, program.id, stage.id, !stage.isPublished);
            const deleteStageAction = deleteStage.bind(null, program.id, stage.id);
            const moveUpAction = moveStageOrder.bind(null, program.id, stage.id, "up");
            const moveDownAction = moveStageOrder.bind(null, program.id, stage.id, "down");

            return (
              <Card key={stage.id} className="gap-0 overflow-hidden py-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-primary/5 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Badge className="mt-0.5 size-8 shrink-0 justify-center rounded-full p-0 text-sm">
                      {si + 1}
                    </Badge>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-lg font-semibold">{stage.title}</span>
                        <StatusBadge isPublished={stage.isPublished} />
                      </div>
                      {stage.description && (
                        <p className="max-w-xl text-sm text-muted-foreground">{stage.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">
                          {stage.prerequisiteStage ? (
                            <>
                              <Lock className="size-3" /> Requires Stage {stage.prerequisiteStage.order + 1} —{" "}
                              {stage.prerequisiteStage.title}
                            </>
                          ) : (
                            "Always unlocked"
                          )}
                        </Badge>
                        {stage.requireAllLessons && (
                          <Badge variant="outline" className="text-xs">
                            <BookOpen className="size-3" /> All lessons
                          </Badge>
                        )}
                        {stage.requireQuizPass && (
                          <Badge variant="outline" className="text-xs">
                            Min score {stage.minQuizScore ?? 0}%
                          </Badge>
                        )}
                        {stage.requireTrainerApproval && (
                          <Badge variant="outline" className="text-xs">
                            <ShieldCheck className="size-3" /> Trainer approval
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <div className="flex flex-col">
                      <form action={moveUpAction}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-xs"
                          disabled={si === 0}
                          aria-label="Move stage up"
                        >
                          <ChevronDown className="size-3.5 rotate-180" />
                        </Button>
                      </form>
                      <form action={moveDownAction}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-xs"
                          disabled={si === program.stages.length - 1}
                          aria-label="Move stage down"
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                      </form>
                    </div>
                    <EditStageDialog
                      programId={program.id}
                      stageId={stage.id}
                      title={stage.title}
                      description={stage.description}
                      isPublished={stage.isPublished}
                      prerequisiteStageId={stage.prerequisiteStageId}
                      requireAllLessons={stage.requireAllLessons}
                      requireQuizPass={stage.requireQuizPass}
                      requireTrainerApproval={stage.requireTrainerApproval}
                      gatingQuizId={stage.gatingQuizId}
                      minQuizScore={stage.minQuizScore}
                      stageOptions={stageOptions}
                      quizOptions={quizOptions}
                    />
                    <form action={publishStageAction}>
                      <Button type="submit" variant="outline" size="sm">
                        {stage.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                    </form>
                    <DeleteConfirmDialog
                      trigger={<Trash2 className="size-4" />}
                      title={`Delete "${stage.title}"?`}
                      description="This permanently deletes the stage along with all its courses, modules, and lessons. This cannot be undone."
                      action={deleteStageAction}
                      confirmLabel="Delete stage"
                    />
                  </div>
                </div>

                <div className="grid gap-4 p-4">
                  {stage.courses.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">
                      No courses in this stage yet.
                    </p>
                  ) : (
                    renderCourses(stage.courses)
                  )}
                  <div>
                    <CreateCourseDialog programId={program.id} stageId={stage.id} />
                  </div>
                  {stage.requireTrainerApproval && (
                    <StageApprovalsCard
                      programId={program.id}
                      stageId={stage.id}
                      approvals={approvals}
                      eligibleTrainees={trainees}
                    />
                  )}
                </div>
              </Card>
            );
          })}
          <div>
            <CreateStageDialog programId={program.id} stageOptions={stageOptions} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {program.courses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Start building this program by adding your first course, or add a Stage to use the guided training-journey structure."
            />
          ) : (
            renderCourses(program.courses)
          )}
          <div className="flex flex-wrap gap-2">
            <CreateStageDialog programId={program.id} stageOptions={stageOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
