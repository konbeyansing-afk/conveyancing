"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

export async function createResource(formData: FormData) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  const url = (formData.get("url") as string)?.trim();
  const fileType = (formData.get("fileType") as string)?.trim();
  if (!title || !url || !fileType) return;

  const description = (formData.get("description") as string)?.trim() || null;
  const programId = (formData.get("programId") as string)?.trim() || null;

  await prisma.resourceLibraryItem.create({
    data: { title, url, fileType, description, programId },
  });

  revalidatePath("/admin/resources");
  revalidatePath("/app/resources");
}

export async function updateResource(resourceId: string, formData: FormData) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  const url = (formData.get("url") as string)?.trim();
  const fileType = (formData.get("fileType") as string)?.trim();
  if (!title || !url || !fileType) return;

  const description = (formData.get("description") as string)?.trim() || null;
  const programId = (formData.get("programId") as string)?.trim() || null;

  await prisma.resourceLibraryItem.update({
    where: { id: resourceId },
    data: { title, url, fileType, description, programId },
  });

  revalidatePath("/admin/resources");
  revalidatePath("/app/resources");
}

export async function deleteResource(resourceId: string, _formData: FormData) {
  await requireRole("ADMIN");
  await prisma.resourceLibraryItem.delete({ where: { id: resourceId } });
  revalidatePath("/admin/resources");
  revalidatePath("/app/resources");
}
