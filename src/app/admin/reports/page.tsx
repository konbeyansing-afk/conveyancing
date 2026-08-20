import { BarChart3, CheckCircle2, TrendingUp, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";

export default async function AdminReportsPage() {
  const [courses, completedProgress, enrollmentCount, traineeCount] = await Promise.all([
    prisma.course.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        program: { select: { title: true } },
        stage: { select: { title: true } },
        modules: { include: { lessons: { where: { isPublished: true }, select: { id: true } } } },
        enrollments: { select: { userId: true } },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { completedAt: { not: null } },
      select: { userId: true, lessonId: true },
    }),
    prisma.enrollment.count(),
    prisma.user.count({ where: { role: "TRAINEE" } }),
  ]);

  const completedKeys = new Set(completedProgress.map((p) => `${p.userId}:${p.lessonId}`));

  const rows = courses.map((course) => {
    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const enrolledUserIds = course.enrollments.map((e) => e.userId);
    let actual = 0;
    for (const userId of enrolledUserIds) {
      for (const lessonId of lessonIds) {
        if (completedKeys.has(`${userId}:${lessonId}`)) actual++;
      }
    }
    const possible = lessonIds.length * enrolledUserIds.length;
    return {
      id: course.id,
      title: course.title,
      programTitle: course.stage ? course.stage.title : course.program.title,
      traineeCount: enrolledUserIds.length,
      lessonCount: lessonIds.length,
      completion: possible > 0 ? Math.round((actual / possible) * 100) : 0,
    };
  });

  const withEnrollments = rows.filter((r) => r.traineeCount > 0);
  const overallCompletion =
    withEnrollments.length > 0
      ? Math.round(withEnrollments.reduce((s, r) => s + r.completion, 0) / withEnrollments.length)
      : 0;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">
          Completion and progress analytics across every course, computed from real enrollment
          and lesson-progress data.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total enrollments" value={enrollmentCount} icon={Users} />
        <StatCard label="Active trainees" value={traineeCount} icon={Users} />
        <StatCard
          label="Lessons completed"
          value={completedProgress.length}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="Overall completion" value={`${overallCompletion}%`} icon={TrendingUp} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing to report yet"
          description="Once trainees are enrolled and working through lessons, course-by-course completion will show up here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-2.5 font-medium">Course</th>
                <th className="px-4 py-2.5 font-medium">Trainees</th>
                <th className="px-4 py-2.5 font-medium">Published Lessons</th>
                <th className="px-4 py-2.5 font-medium">Completion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.programTitle}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.traineeCount}</td>
                  <td className="px-4 py-3 tabular-nums">{row.lessonCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={row.completion} className="w-28" />
                      <span className="text-xs font-medium tabular-nums">{row.completion}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
