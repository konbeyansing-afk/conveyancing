import Link from "next/link";
import { ArrowUpRight, Plus, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CreateProgramDialog } from "@/components/admin/program-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { CoverIcon } from "@/lib/cover-theme";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function AdminDashboardPage() {
  const [
    traineeCount,
    newEnrollmentsThisMonth,
    programCount,
    draftProgramCount,
    publishedLessonCount,
    draftLessonCount,
    programs,
    completedProgress,
    recentEnrollments,
    recentCompletions,
    recentQuizAttempts,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "TRAINEE" } }),
    prisma.enrollment.count({ where: { enrolledAt: { gte: startOfMonth() } } }),
    prisma.program.count(),
    prisma.program.count({ where: { isPublished: false } }),
    prisma.lesson.count({ where: { isPublished: true } }),
    prisma.lesson.count({ where: { isPublished: false } }),
    prisma.program.findMany({
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: {
        courses: {
          include: {
            modules: { include: { lessons: { where: { isPublished: true }, select: { id: true } } } },
            enrollments: { select: { userId: true } },
          },
        },
        stages: {
          include: {
            courses: {
              include: {
                modules: { include: { lessons: { where: { isPublished: true }, select: { id: true } } } },
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
    prisma.enrollment.findMany({
      orderBy: { enrolledAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } }, course: { select: { title: true } } },
    }),
    prisma.lessonProgress.findMany({
      where: { completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } }, lesson: { select: { title: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } }, quiz: { select: { title: true } } },
    }),
  ]);

  const completedKeys = new Set(completedProgress.map((p) => `${p.userId}:${p.lessonId}`));

  const programSummaries = programs.map((program) => {
    let totalPossible = 0;
    let totalActual = 0;
    const traineeIds = new Set<string>();
    let lessonCount = 0;
    const allCourses = [...program.courses, ...program.stages.flatMap((s) => s.courses)];

    for (const course of allCourses) {
      const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const enrolledUserIds = course.enrollments.map((e) => e.userId);
      enrolledUserIds.forEach((id) => traineeIds.add(id));
      lessonCount += lessonIds.length;
      totalPossible += lessonIds.length * enrolledUserIds.length;
      for (const userId of enrolledUserIds) {
        for (const lessonId of lessonIds) {
          if (completedKeys.has(`${userId}:${lessonId}`)) totalActual++;
        }
      }
    }

    return {
      id: program.id,
      title: program.title,
      coverImageUrl: program.coverImageUrl,
      courseCount: allCourses.length,
      lessonCount,
      traineeCount: traineeIds.size,
      completion: totalPossible > 0 ? Math.round((totalActual / totalPossible) * 100) : 0,
    };
  });

  type Activity = { key: string; timestamp: Date; message: string; dot: string };
  const activity: Activity[] = [
    ...recentEnrollments.map((e) => ({
      key: `enroll-${e.id}`,
      timestamp: e.enrolledAt,
      message: `${e.user.name} enrolled in ${e.course.title}`,
      dot: "bg-primary",
    })),
    ...recentCompletions.map((p) => ({
      key: `complete-${p.userId}-${p.lessonId}`,
      timestamp: p.completedAt!,
      message: `${p.user.name} completed ${p.lesson.title}`,
      dot: "bg-emerald-500",
    })),
    ...recentQuizAttempts.map((a) => ({
      key: `quiz-${a.id}`,
      timestamp: a.submittedAt!,
      message: `${a.user.name} scored ${a.score}% on ${a.quiz.title}`,
      dot: a.passed ? "bg-emerald-500" : "bg-amber-500",
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 6);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-balance">Welcome back, Admin</h1>
        <p className="text-muted-foreground">
          Here is what is happening across your training programs today.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="grid gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Active Trainees
            </p>
            <p className="text-3xl font-semibold tabular-nums">{traineeCount}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {newEnrollmentsThisMonth > 0
                ? `↑ ${newEnrollmentsThisMonth} enrolled this month`
                : "No new enrollments this month"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Training Programs
            </p>
            <p className="text-3xl font-semibold tabular-nums">{programCount}</p>
            <p className="text-xs text-muted-foreground">
              {draftProgramCount} program{draftProgramCount === 1 ? "" : "s"} in draft
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Published Lessons
            </p>
            <p className="text-3xl font-semibold tabular-nums">{publishedLessonCount}</p>
            <p className="text-xs text-muted-foreground">
              {draftLessonCount} lesson{draftLessonCount === 1 ? "" : "s"} in draft
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Avg. Completion
            </p>
            <p className="text-3xl font-semibold tabular-nums">
              {programSummaries.length > 0
                ? Math.round(
                    programSummaries.reduce((s, p) => s + p.completion, 0) / programSummaries.length
                  )
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground">Across enrolled trainees</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Training Programs</CardTitle>
            <Link
              href="/admin/programs"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {programSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No programs yet — create one to get started.
              </p>
            ) : (
              <div className="grid gap-5">
                {programSummaries.map((program) => (
                  <div key={program.id} className="flex items-start gap-3">
                    <CoverIcon
                      title={program.title}
                      imageUrl={program.coverImageUrl}
                      className="mt-0.5"
                    />
                    <div className="grid min-w-0 flex-1 gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/admin/programs/${program.id}`}
                          className="min-w-0 truncate font-medium hover:underline"
                        >
                          {program.title}
                        </Link>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                          {program.completion}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {program.courseCount} course{program.courseCount === 1 ? "" : "s"} ·{" "}
                        {program.lessonCount} lesson{program.lessonCount === 1 ? "" : "s"} ·{" "}
                        {program.traineeCount} trainee{program.traineeCount === 1 ? "" : "s"}
                      </p>
                      <Progress value={program.completion} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button className="w-full" nativeButton={false} render={<Link href="/admin/programs" />}>
                <Plus /> Create New Lesson
              </Button>
              <CreateProgramDialog triggerVariant="outline" triggerClassName="w-full" />
              <Button
                variant="outline"
                className="w-full"
                nativeButton={false}
                render={<Link href="/admin/users" />}
              >
                <UserPlus /> Add Trainee
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing yet — activity will show up here as trainees get enrolled and start
                  learning.
                </p>
              ) : (
                <ul className="grid gap-4">
                  {activity.map((item) => (
                    <li key={item.key} className="flex gap-2.5 text-sm">
                      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.dot}`} />
                      <div>
                        <p>{item.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.timestamp)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
