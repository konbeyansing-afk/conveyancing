"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import {
  createPendingCertificate,
  issueCertificate,
  revokeCertificate,
} from "@/lib/certificates";
import { canTrainerActOnTrainee } from "@/lib/trainer-scope";

export type CertificateActionState = { error?: string; success?: string } | null;

/**
 * Issues a certificate. Trainers and admins only, and a trainer only for a
 * trainee assigned to them.
 */
export async function issueCertificateAction(
  certificateId: string,
  _prevState: CertificateActionState,
  _formData: FormData
): Promise<CertificateActionState> {
  const actor = await requireRole("ADMIN", "TRAINER");

  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    select: { userId: true },
  });
  if (!certificate) return { error: "That certificate no longer exists." };

  if (!(await canTrainerActOnTrainee(actor, certificate.userId))) {
    return { error: "That trainee is not assigned to you." };
  }

  const result = await issueCertificate(certificateId, actor.id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/certificates");
  revalidatePath("/trainer/certificates");
  return { success: `Issued ${result.certificate.certificateNumber}.` };
}

/** Revokes an issued certificate. Admins only — a trainer cannot undo a sign-off. */
export async function revokeCertificateAction(
  certificateId: string,
  _prevState: CertificateActionState,
  formData: FormData
): Promise<CertificateActionState> {
  await requireRole("ADMIN");

  const reason = (formData.get("reason") as string) ?? "";
  const result = await revokeCertificate(certificateId, reason);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/certificates");
  return { success: `Revoked ${result.certificate.certificateNumber}.` };
}

/**
 * Creates the pending record for a program a trainee has finished.
 *
 * Deliberately takes no user id — it always acts for the signed-in trainee, so
 * it cannot be pointed at somebody else's record.
 */
export async function claimCertificateAction(
  programId: string,
  _prevState: CertificateActionState,
  _formData: FormData
): Promise<CertificateActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "You are not signed in." };

  const result = await createPendingCertificate(userId, programId);
  if ("error" in result) {
    if (result.error.eligible) return { error: "Something went wrong." };
    return {
      error:
        result.error.reason === "not_enrolled"
          ? "You are not enrolled in this program."
          : "You have not completed every stage of this program yet.",
    };
  }

  revalidatePath("/app/certificates");
  return { success: "Your certificate has been sent for sign-off." };
}
