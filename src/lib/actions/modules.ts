"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

function coursePath(programId: string, courseId: string) {
  return `/admin/programs/${programId}/courses/${courseId}`;
}

export async function createModule(
  programId: string,
  courseId: string,
  formData: FormData
) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const order = await prisma.module.count({ where: { courseId } });

  await prisma.module.create({ data: { courseId, title, order } });

  revalidatePath(coursePath(programId, courseId));
}

export async function updateModule(
  programId: string,
  courseId: string,
  moduleId: string,
  formData: FormData
) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const order = Number(formData.get("order")) || 0;

  await prisma.module.update({ where: { id: moduleId }, data: { title, order } });

  revalidatePath(coursePath(programId, courseId));
}

export async function deleteModule(
  programId: string,
  courseId: string,
  moduleId: string,
  _formData: FormData
) {
  await requireRole("ADMIN");
  await prisma.module.delete({ where: { id: moduleId } });
  revalidatePath(coursePath(programId, courseId));
}
