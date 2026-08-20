"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { uniqueSlug } from "@/lib/slugify";

export async function createProgram(formData: FormData) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const description = (formData.get("description") as string)?.trim() || null;
  const coverImageUrl = (formData.get("coverImageUrl") as string)?.trim() || null;
  const isPublished = formData.get("status") === "published";
  const slug = await uniqueSlug(
    title,
    async (candidate) => (await prisma.program.count({ where: { slug: candidate } })) > 0
  );

  const program = await prisma.program.create({
    data: { title, slug, description, coverImageUrl, isPublished },
  });

  revalidatePath("/admin/programs");
  redirect(`/admin/programs/${program.id}`);
}

export async function updateProgram(programId: string, formData: FormData) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const description = (formData.get("description") as string)?.trim() || null;
  const coverImageUrl = (formData.get("coverImageUrl") as string)?.trim() || null;
  const isPublished = formData.get("isPublished") === "on";

  await prisma.program.update({
    where: { id: programId },
    data: { title, description, coverImageUrl, isPublished },
  });

  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/programs");
}

export async function toggleProgramPublish(programId: string, isPublished: boolean) {
  await requireRole("ADMIN");
  await prisma.program.update({ where: { id: programId }, data: { isPublished } });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/programs");
}

export async function deleteProgram(programId: string, _formData: FormData) {
  await requireRole("ADMIN");
  await prisma.program.delete({ where: { id: programId } });
  revalidatePath("/admin/programs");
  redirect("/admin/programs");
}
