import { auth } from "@/auth";

/** Admins and trainers can preview draft (unpublished) courses/lessons; trainees cannot. */
export async function canPreviewUnpublished() {
  const session = await auth();
  const role = session?.user?.role;
  return role === "ADMIN" || role === "TRAINER";
}
