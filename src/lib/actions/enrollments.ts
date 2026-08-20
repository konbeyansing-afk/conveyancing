"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

export async function enrollTrainee(programId: string, courseId: string, formData: FormData) {
  await requireRole("ADMIN");

  const userId = (formData.get("userId") as string)?.trim();
  if (!userId) return;

  const trainee = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!trainee || trainee.role !== "TRAINEE") return;

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId },
  });

  revalidatePath(`/admin/programs/${programId}/courses/${courseId}`);
}

export async function unenrollTrainee(
  programId: string,
  courseId: string,
  enrollmentId: string,
  _formData: FormData
) {
  await requireRole("ADMIN");
  await prisma.enrollment.delete({ where: { id: enrollmentId } });
  revalidatePath(`/admin/programs/${programId}/courses/${courseId}`);
}
