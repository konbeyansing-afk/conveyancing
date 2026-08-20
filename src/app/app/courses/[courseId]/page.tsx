import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished } from "@/lib/stage-access";
import { DraftPreviewBanner } from "@/components/draft-preview-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TraineeCourseOverviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      program: true,
      stage: { include: { program: true } },
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });

  const isPublished = course && isCoursePublished(course);
  const staffPreview = await canPreviewUnpublished();
  const session = await auth();
  const userId = session?.user?.id;
  const stageUnlocked =
    course && course.stage && userId ? await isStageUnlockedForUser(course.stage.id, userId) : true;
  const allowed =
    course && (staffPreview || (isPublished && (await isEnrolledInCourse(course.id)) && stageUnlocked));
  if (!course || !allowed) notFound();

  // Trainees only ever see published lessons; staff previewing a draft see everything.
  const visibleModules = staffPreview
    ? course.modules
    : course.modules.map((module) => ({
        ...module,
        lessons: module.lessons.filter((lesson) => lesson.isPublished),
      }));

  return (
    <div className="grid gap-6">
      {!isPublished && <DraftPreviewBanner />}
      <div>
        <Link href="/app/courses" className="text-sm text-muted-foreground hover:underline">
          ← Courses
        </Link>
        <h1 className="text-2xl font-semibold">{course.title}</h1>
        {course.description && <p className="text-muted-foreground">{course.description}</p>}
      </div>

      <div className="grid gap-4">
        {visibleModules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="text-base">{module.title}</CardTitle>
              {module.lessons.length === 0 && (
                <CardDescription>No lessons in this module yet.</CardDescription>
              )}
            </CardHeader>
            {module.lessons.length > 0 && (
              <CardContent className="grid gap-1">
                {module.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/app/courses/${course.id}/lessons/${lesson.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    {lesson.title}
                  </Link>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
