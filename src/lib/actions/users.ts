"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import {
  generatePassword,
  passwordsMatch,
  validatePassword,
  validateTemporaryPassword,
} from "@/lib/password-policy";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["ADMIN", "TRAINER", "TRAINEE", "VA"];

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
  if (!VALID_ROLES.includes(role)) return { error: "Invalid role." };

  // Only a basic floor, not the full policy — the admin chose this password
  // deliberately and it stays the account's password (there is no self-service
  // change), so it doesn't need to pass the "guessable/reused" checks a
  // trainee picking their own password would.
  const policy = validateTemporaryPassword(password);
  if (!policy.ok) return { error: policy.error };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

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

export type ResetPasswordState = { error?: string; temporaryPassword?: string } | null;

/**
 * An admin resets a password — the "I'm locked out" path. There is no
 * self-service password change anywhere in this app (by design: an admin is
 * the only one who can set a password, including their own), so this and
 * setUserPassword below are the only ways any account's password ever
 * changes.
 *
 * A random password is generated and shown to the admin once so they can
 * relay it — the admin never types it in on the target's behalf, so it's
 * never visible to anyone but whoever it gets relayed to.
 */
export async function resetUserPassword(
  userId: string,
  _prevState: ResetPasswordState,
  _formData: FormData
): Promise<ResetPasswordState> {
  await requireRole("ADMIN");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return { error: "That user no longer exists." };

  const temporaryPassword = generatePassword();
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      passwordChangedAt: new Date(),
    },
  });

  revalidatePath("/admin/users");
  return { temporaryPassword };
}

/**
 * Sets a specific password for an account (including the admin's own). Used
 * only where an admin needs to choose the value themselves; the generated
 * reset above is preferred.
 */
export async function setUserPassword(
  userId: string,
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  await requireRole("ADMIN");

  const password = (formData.get("password") as string) ?? "";
  const confirmation = (formData.get("confirmPassword") as string) ?? "";

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!target) return { error: "That user no longer exists." };

  const match = passwordsMatch(password, confirmation);
  if (!match.ok) return { error: match.error };

  const policy = validatePassword(password, { name: target.name, email: target.email });
  if (!policy.ok) return { error: policy.error };

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      passwordChangedAt: new Date(),
    },
  });

  revalidatePath("/admin/users");
  return {};
}
