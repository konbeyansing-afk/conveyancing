import { Layers, CheckCircle2, FileEdit, BookOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { CreateProgramDialog } from "@/components/admin/program-dialogs";
import { ProgramsGrid, type ProgramSummary } from "@/components/admin/programs-grid";

export default async function AdminProgramsPage() {
  const [programs, completedProgress] = await Promise.all([
    prisma.program.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        // Legacy direct relation (only the one pre-Stage course still uses this) plus the
        // new Stage-based relation — a program only ever has data in one or the other.
        courses: {
          include: {
            modules: { include: { lessons: { select: { id: true, isPublished: true } } } },
            enrollments: { select: { userId: true } },
          },
        },
        stages: {
          include: {
            courses: {
              include: {
                modules: { include: { lessons: { select: { id: true, isPublished: true } } } },
                enrollments: { select: { userId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { completedAt: { not: null } },
      select: { userId: true, lessonId: true },
    }),
  ]);

  const completedKeys = new Set(completedProgress.map((p) => `${p.userId}:${p.lessonId}`));

  const summaries: ProgramSummary[] = programs.map((program) => {
    const allCourses = [...program.courses, ...program.stages.flatMap((s) => s.courses)];
    const courseCount = allCourses.length;
    const moduleCount = allCourses.reduce((sum, c) => sum + c.modules.length, 0);
    const lessonCount = allCourses.reduce(
      (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.length, 0),
      0
    );

    const traineeIds = new Set<string>();
    let totalPossible = 0;
    let totalActual = 0;
    for (const course of allCourses) {
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

    return {
      id: program.id,
      title: program.title,
      description: program.description,
      coverImageUrl: program.coverImageUrl,
      isPublished: program.isPublished,
      updatedAt: program.updatedAt.toISOString(),
      courseCount,
      moduleCount,
      lessonCount,
      traineeCount: traineeIds.size,
      completion: totalPossible > 0 ? Math.round((totalActual / totalPossible) * 100) : 0,
    };
  });

  const publishedCount = summaries.filter((p) => p.isPublished).length;
  const totalCourses = summaries.reduce((sum, p) => sum + p.courseCount, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Programs</h1>
          <p className="text-muted-foreground">
            Manage your company&apos;s training programs and learning pathways.
          </p>
        </div>
        <CreateProgramDialog />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total programs" value={summaries.length} icon={Layers} />
        <StatCard label="Published" value={publishedCount} icon={CheckCircle2} tone="success" />
        <StatCard
          label="Draft programs"
          value={summaries.length - publishedCount}
          icon={FileEdit}
          tone="warning"
        />
        <StatCard label="Total courses" value={totalCourses} icon={BookOpen} />
      </div>

      <ProgramsGrid programs={summaries} />
    </div>
  );
}
