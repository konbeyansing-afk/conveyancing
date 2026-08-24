import { Award, BookOpen, CheckCircle2, PlayCircle } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isCoursePublished } from "@/lib/stage-access";
import { StatTile } from "@/components/stat-tile";
import { CoursesExplorer } from "@/components/trainee/courses-explorer";
import { TrainingGuidanceCard } from "@/components/trainee/training-guidance-card";
import type { TraineeCourseSummary } from "@/components/trainee/course-card";
import type { CourseStatus } from "@/components/trainee/course-status-badge";

export default async function TraineeCoursesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const firstName = (session!.user.name ?? "there").split(" ")[0];

  const certificateCounts = await prisma.certificate.groupBy({
    by: ["status"],
    where: { userId },
    _count: true,
  });
  const issuedCertificates = certificateCounts.find((c) => c.status === "ISSUED")?._count ?? 0;
  const pendingCertificates =
    certificateCounts.find((c) => c.status === "PENDING_APPROVAL")?._count ?? 0;

  const allEnrollments = await prisma.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: "desc" },
    include: {
      course: {
        include: {
          program: true,
          stage: { include: { program: true } },
          modules: {
            orderBy: { order: "asc" },
            include: { lessons: { where: { isPublished: true }, select: { id: true } } },
          },
        },
      },
    },
  });
  const enrollments = allEnrollments.filter((e) => isCoursePublished(e.course));

  const lessonIds = enrollments.flatMap((enrollment) =>
    enrollment.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id))
  );

  const completedProgress = lessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
        select: { lessonId: true },
      })
    : [];
  const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));

  const courses: TraineeCourseSummary[] = enrollments.map(({ course }) => {
    const lessonCount = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    const completedCount = course.modules.reduce(
      (sum, m) => sum + m.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length,
      0
    );
    const progressPercent =
      lessonCount === 0 ? 0 : Math.round((completedCount / lessonCount) * 100);
    const status: CourseStatus =
      lessonCount > 0 && completedCount === lessonCount
        ? "completed"
        : completedCount > 0
          ? "in-progress"
          : "not-started";

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      programTitle: course.stage ? course.stage.title : course.program.title,
      programCoverImageUrl: course.stage ? course.stage.program.coverImageUrl : course.program.coverImageUrl,
      moduleCount: course.modules.length,
      lessonCount,
      progressPercent,
      status,
    };
  });

  const inProgressCount = courses.filter((c) => c.status === "in-progress").length;
  const completedCount = courses.filter((c) => c.status === "completed").length;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-balance">Welcome back, {firstName}</h1>
        <p className="text-muted-foreground">
          Track your training, continue your lessons, and monitor your progress.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={BookOpen}
          value={courses.length}
          label="Enrolled Courses"
          hint="Courses assigned"
          tone="primary"
        />
        <StatTile
          icon={PlayCircle}
          value={inProgressCount}
          label="In Progress"
          hint="Keep going"
          tone="warning"
        />
        <StatTile
          icon={CheckCircle2}
          value={completedCount}
          label="Completed"
          hint="Great work"
          tone="success"
        />
        <StatTile
          icon={Award}
          value={issuedCertificates}
          label="Certificates"
          hint={
            pendingCertificates > 0
              ? `${pendingCertificates} awaiting sign-off`
              : issuedCertificates > 0
                ? "Earned"
                : "Finish a program to earn one"
          }
        />
      </div>

      <CoursesExplorer courses={courses} />

      <TrainingGuidanceCard />
    </div>
  );
}
