import { Users, UserCheck, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { TraineesTable, type TraineeSummary } from "@/components/admin/trainees-table";
import { TrainerAssignmentsCard } from "@/components/admin/trainer-assignments-card";

export default async function AdminTraineesPage() {
  const [trainees, completedProgress, quizAttempts, trainers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TRAINEE" },
      orderBy: { name: "asc" },
      include: {
        enrollments: {
          select: {
            enrolledAt: true,
            course: {
              select: {
                modules: { select: { lessons: { where: { isPublished: true }, select: { id: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { completedAt: { not: null } },
      select: { userId: true, lessonId: true, completedAt: true },
    }),
    prisma.quizAttempt.findMany({
      where: { submittedAt: { not: null } },
      select: { userId: true, submittedAt: true },
    }),
    prisma.user.findMany({
      where: { role: "TRAINER" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        trainerAssignments: {
          select: { trainee: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const completedByUser = new Map<string, Set<string>>();
  for (const p of completedProgress) {
    if (!completedByUser.has(p.userId)) completedByUser.set(p.userId, new Set());
    completedByUser.get(p.userId)!.add(p.lessonId);
  }

  const lastActivityByUser = new Map<string, Date>();
  function bump(userId: string, date: Date | null) {
    if (!date) return;
    const current = lastActivityByUser.get(userId);
    if (!current || date > current) lastActivityByUser.set(userId, date);
  }
  for (const p of completedProgress) bump(p.userId, p.completedAt);
  for (const a of quizAttempts) bump(a.userId, a.submittedAt);

  const summaries: TraineeSummary[] = trainees.map((trainee) => {
    const completedLessons = completedByUser.get(trainee.id) ?? new Set<string>();
    let completedCourseCount = 0;
    let completionSum = 0;

    for (const enrollment of trainee.enrollments) {
      const lessonIds = enrollment.course.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const completedCount = lessonIds.filter((id) => completedLessons.has(id)).length;
      const pct = lessonIds.length > 0 ? Math.round((completedCount / lessonIds.length) * 100) : 0;
      completionSum += pct;
      if (lessonIds.length > 0 && completedCount === lessonIds.length) completedCourseCount++;
      bump(trainee.id, enrollment.enrolledAt);
    }

    const lastActivity = lastActivityByUser.get(trainee.id);

    return {
      id: trainee.id,
      name: trainee.name,
      email: trainee.email,
      enrollmentCount: trainee.enrollments.length,
      completedCourseCount,
      avgCompletion:
        trainee.enrollments.length > 0 ? Math.round(completionSum / trainee.enrollments.length) : 0,
      lastActivity: lastActivity ? lastActivity.toISOString() : null,
    };
  });

  const enrolledCount = summaries.filter((t) => t.enrollmentCount > 0).length;
  const overallAvg =
    summaries.length > 0
      ? Math.round(summaries.reduce((s, t) => s + t.avgCompletion, 0) / summaries.length)
      : 0;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Trainees</h1>
        <p className="text-muted-foreground">
          See who&apos;s enrolled, how far along they are, and when they were last active.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total trainees" value={summaries.length} icon={Users} />
        <StatCard label="Enrolled in a course" value={enrolledCount} icon={UserCheck} tone="success" />
        <StatCard label="Avg. progress" value={`${overallAvg}%`} icon={TrendingUp} />
      </div>

      <TrainerAssignmentsCard
        trainers={trainers.map((trainer) => ({
          id: trainer.id,
          name: trainer.name,
          email: trainer.email,
          trainees: trainer.trainerAssignments.map((a) => a.trainee),
        }))}
        trainees={summaries.map((t) => ({ id: t.id, name: t.name, email: t.email }))}
      />

      <TraineesTable trainees={summaries} />
    </div>
  );
}
