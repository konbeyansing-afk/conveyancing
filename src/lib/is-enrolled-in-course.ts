import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Whether the current session's trainee is enrolled in the given course. */
export async function isEnrolledInCourse(courseId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  return !!enrollment;
}
