"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["ADMIN", "TRAINER", "TRAINEE"];

export type CreateUserState = { error?: string } | null;

export async function createUser(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  await requireRole("ADMIN");

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const role = formData.get("role") as Role;

  if (!name || !email || !password) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!VALID_ROLES.includes(role)) return { error: "Invalid role." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { name, email, passwordHash, role } });

  revalidatePath("/admin/users");
  return null;
}

export async function updateUserRole(userId: string, formData: FormData) {
  const actor = await requireRole("ADMIN");
  if (actor.id === userId) return;

  const role = formData.get("role") as Role;
  if (!VALID_ROLES.includes(role)) return;

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string, _formData: FormData) {
  const actor = await requireRole("ADMIN");
  if (actor.id === userId) return;

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
