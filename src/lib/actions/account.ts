"use server";

/**
 * Self-service account actions. Available to every signed-in role — a trainee
 * changes their own password the same way an admin does.
 *
 * A password only ever exists here as the plain string the user just typed; it
 * is compared or hashed and then dropped. Nothing about it is returned to the
 * client, and no action here ever accepts a user id — you can only change your
 * own password, because the identity comes from the session.
 */

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { passwordsMatch, validatePassword } from "@/lib/password-policy";

export type ChangePasswordState = { error?: string; success?: boolean } | null;

const BCRYPT_COST = 12;

export async function changeOwnPassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "You are not signed in." };

  const currentPassword = (formData.get("currentPassword") as string) ?? "";
  const newPassword = (formData.get("newPassword") as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!currentPassword) return { error: "Enter your current password." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
  // The session referenced a user that no longer exists.
  if (!user) return { error: "You are not signed in." };

  const currentIsValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentIsValid) return { error: "Your current password is not correct." };

  const match = passwordsMatch(newPassword, confirmPassword);
  if (!match.ok) return { error: match.error };

  const policy = validatePassword(newPassword, {
    name: user.name,
    email: user.email,
    currentPassword,
  });
  if (!policy.ok) return { error: policy.error };

  // Guards against a new password that differs from the typed current one but
  // still matches the stored hash (e.g. differing only by a trailing space that
  // was trimmed elsewhere).
  const sameAsStored = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsStored) return { error: "New password must be different from the current one." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  revalidatePath("/account");
  return { success: true };
}
