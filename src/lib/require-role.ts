import { auth } from "@/auth";
import type { Role } from "@prisma/client";

export async function requireRole(...roles: Role[]) {
  const session = await auth();
  if (!session?.user || !roles.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session.user;
}
