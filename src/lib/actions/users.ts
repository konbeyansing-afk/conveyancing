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

  // A temporary password the admin relays and the holder must replace on
  // first login — only needs a basic floor, not the full policy.
  const policy = validateTemporaryPassword(password);
  if (!policy.ok) return { error: policy.error };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  // A password an admin chose and then relayed to someone is a shared secret,
  // so the account has to replace it before it is really theirs.
  await prisma.user.create({
    data: { name, email, passwordHash, role, mustChangePassword: true },
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
 * An admin resets someone else's password — the "I'm locked out" path.
 *
 * The admin never types the new password and never sees the old one: a random
 * one is generated, shown to the admin once so they can relay it, and the
 * account is flagged so the holder has to replace it on next sign-in.
 *
 * Admins cannot reset their own password this way; they use the account page,
 * which requires the current password.
 */
export async function resetUserPassword(
  userId: string,
  _prevState: ResetPasswordState,
  _formData: FormData
): Promise<ResetPasswordState> {
  const actor = await requireRole("ADMIN");
  if (actor.id === userId) {
    return { error: "Change your own password from your account page." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return { error: "That user no longer exists." };

  const temporaryPassword = generatePassword();
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
  });

  revalidatePath("/admin/users");
  return { temporaryPassword };
}

/**
 * Sets a specific password for another account. Used only where an admin needs
 * to choose the value themselves; the generated reset above is preferred.
 */
export async function setUserPassword(
  userId: string,
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const actor = await requireRole("ADMIN");
  if (actor.id === userId) {
    return { error: "Change your own password from your account page." };
  }

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
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
  });

  revalidatePath("/admin/users");
  return {};
}
