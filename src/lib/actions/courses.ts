"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { uniqueSlug } from "@/lib/slugify";

export async function createCourse(programId: string, stageId: string, formData: FormData) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const description = (formData.get("description") as string)?.trim() || null;
  const order = await prisma.course.count({ where: { stageId } });
  const slug = await uniqueSlug(
    title,
    async (candidate) =>
      (await prisma.course.count({ where: { programId, slug: candidate } })) > 0
  );

  await prisma.course.create({
    data: { programId, stageId, title, slug, description, order },
  });

  revalidatePath(`/admin/programs/${programId}`);
}

export async function updateCourse(
  programId: string,
  courseId: string,
  formData: FormData
) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const description = (formData.get("description") as string)?.trim() || null;
  const isPublished = formData.get("isPublished") === "on";
  const order = Number(formData.get("order")) || 0;

  await prisma.course.update({
    where: { id: courseId },
    data: { title, description, isPublished, order },
  });

  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath(`/admin/programs/${programId}/courses/${courseId}`);
}

export async function toggleCoursePublish(
  programId: string,
  courseId: string,
  isPublished: boolean
) {
  await requireRole("ADMIN");
  await prisma.course.update({ where: { id: courseId }, data: { isPublished } });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath(`/admin/programs/${programId}/courses/${courseId}`);
}

export async function deleteCourse(
  programId: string,
  courseId: string,
  _formData: FormData
) {
  await requireRole("ADMIN");
  await prisma.course.delete({ where: { id: courseId } });
  revalidatePath(`/admin/programs/${programId}`);
  redirect(`/admin/programs/${programId}`);
}
