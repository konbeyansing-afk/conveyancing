import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileText } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getJourneyForUser } from "@/lib/stage-access";
import { LockedStageExplanation } from "@/components/trainee/locked-stage-explanation";
import { StageStatusBadge } from "@/components/trainee/stage-status-badge";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ stageId: string }>;
}) {
  const { stageId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const stageRecord = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { programId: true },
  });
  if (!stageRecord) notFound();

  const stages = await getJourneyForUser(stageRecord.programId, userId);
  const current = stages.find((s) => s.id === stageId);
  if (!current) notFound();

  if (current.status === "locked") {
    const prerequisite = current.prerequisiteStageId
      ? (stages.find((s) => s.id === current.prerequisiteStageId) ?? null)
      : null;
    return <LockedStageExplanation stage={current} prerequisiteStage={prerequisite} />;
  }

  const courses = await prisma.course.findMany({
    where: { stageId },
    orderBy: { order: "asc" },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { where: { isPublished: true }, orderBy: { order: "asc" } } },
      },
    },
  });
  const lessonIds = courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
  const completedProgress = lessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
        select: { lessonId: true },
      })
    : [];
  const completedSet = new Set(completedProgress.map((p) => p.lessonId));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div>
        <Link href="/app/journey" className="text-sm text-muted-foreground hover:underline">
          ← Training Journey
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Stage {current.order + 1}
          </p>
          <StageStatusBadge status={current.status} />
        </div>
        <h1 className="text-2xl font-semibold">{current.title}</h1>
        {current.description && <p className="text-muted-foreground">{current.description}</p>}
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No content yet"
          description="This stage doesn't have any lessons published yet — check back soon."
        />
      ) : (
        <div className="grid gap-4">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <CardTitle className="text-base">{course.title}</CardTitle>
                {course.description && <CardDescription>{course.description}</CardDescription>}
              </CardHeader>
              <CardContent className="grid gap-3">
                {course.modules.map((module) => (
                  <div key={module.id} className="grid gap-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {module.title}
                    </p>
                    {module.lessons.map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={`/app/courses/${course.id}/lessons/${lesson.id}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        {completedSet.has(lesson.id) ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <FileText className="size-4 text-muted-foreground" />
                        )}
                        {lesson.title}
                      </Link>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
