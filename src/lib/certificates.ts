import { prisma } from "@/lib/prisma";
import { completedAt, isProgramComplete } from "@/lib/completion";
import { Prisma, type Certificate, type CertificateStatus } from "@prisma/client";

/**
 * Certificate lifecycle.
 *
 *   program complete  →  PENDING_APPROVAL  →  ISSUED  →  (REVOKED)
 *
 * A certificate is only ever created once the program is genuinely complete —
 * which already means every published stage, including any gating quiz and any
 * trainer sign-off those stages require. It then waits for a human: a trainer
 * or admin issues it, and that step is where competencies the system cannot
 * verify on its own are confirmed (see the simulator note in the README).
 *
 * Nothing here is rendered as a document yet. The lifecycle is the part that
 * has to be right first; PDF generation can read these records later without
 * changing any of it.
 */

/** Where the organisation name on new certificates comes from. */
export const ISSUING_ORGANISATION =
  process.env.CERTIFICATE_ISSUING_ORGANISATION ?? "Conveyancing Academy";

export type Eligibility =
  | { eligible: true }
  | { eligible: false; reason: "not_enrolled" | "program_incomplete" | "already_exists" };

/**
 * Whether a trainee may have a certificate created for a program.
 *
 * Enrolment matters as well as completion: somebody who was never enrolled
 * cannot have completed anything, and a stray record should not be creatable
 * for them by an admin clicking the wrong row.
 */
export async function checkEligibility(userId: string, programId: string): Promise<Eligibility> {
  const enrolments = await prisma.enrollment.count({
    where: {
      userId,
      OR: [{ course: { stage: { programId } } }, { course: { programId } }],
    },
  });
  if (enrolments === 0) return { eligible: false, reason: "not_enrolled" };

  if (!(await isProgramComplete(programId, userId))) {
    return { eligible: false, reason: "program_incomplete" };
  }

  const existing = await prisma.certificate.findUnique({
    where: { userId_programId: { userId, programId } },
    select: { id: true },
  });
  if (existing) return { eligible: false, reason: "already_exists" };

  return { eligible: true };
}

/** Human-readable, sortable, and unique: CA-2026-000042. */
async function nextCertificateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CA-${year}-`;
  const latest = await prisma.certificate.findFirst({
    where: { certificateNumber: { startsWith: prefix } },
    orderBy: { certificateNumber: "desc" },
    select: { certificateNumber: true },
  });
  const previous = latest ? Number(latest.certificateNumber.slice(prefix.length)) : 0;
  return `${prefix}${String(previous + 1).padStart(6, "0")}`;
}

/** Opaque, unguessable, and safe in a URL — the token a third party checks. */
function newVerificationCode(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates the certificate record for a completed program, in PENDING_APPROVAL.
 *
 * Returns the existing record instead of failing if one is already there, so a
 * trainee finishing their last lesson twice does not produce an error.
 */
export async function createPendingCertificate(
  userId: string,
  programId: string,
): Promise<{ certificate: Certificate } | { error: Eligibility }> {
  const eligibility = await checkEligibility(userId, programId);

  if (!eligibility.eligible && eligibility.reason === "already_exists") {
    const existing = await prisma.certificate.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (existing) return { certificate: existing };
  }
  if (!eligibility.eligible) return { error: eligibility };

  const [user, program] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.program.findUnique({ where: { id: programId }, select: { title: true } }),
  ]);
  if (!user || !program) return { error: { eligible: false, reason: "program_incomplete" } };

  // The milestone is the authority on when the program was finished; fall back
  // to now only if the record is somehow missing.
  const finishedAt = (await completedAt(userId, "PROGRAM", programId)) ?? new Date();

  // nextCertificateNumber() is a non-atomic read-latest-then-increment, so two
  // programs completing at nearly the same moment can compute the same number.
  // Rather than serialise every certificate behind a lock, retry on the
  // specific unique constraint that collided: a fresh number (and, on the
  // astronomically unlikely chance, a fresh verification code) resolves a
  // numbering collision, while a collision on userId+programId means someone
  // else's request already created this exact certificate and the existing
  // row is the right answer.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const certificate = await prisma.certificate.create({
        data: {
          userId,
          programId,
          certificateNumber: await nextCertificateNumber(),
          verificationCode: newVerificationCode(),
          status: "PENDING_APPROVAL",
          // Snapshotted so renaming a program later never rewrites history.
          traineeName: user.name,
          programTitle: program.title,
          issuingOrganisation: ISSUING_ORGANISATION,
          completedAt: finishedAt,
        },
      });
      return { certificate };
    } catch (err) {
      const target = uniqueConstraintTarget(err);
      if (!target) throw err;

      if (target.includes("userId") && target.includes("programId")) {
        const existing = await prisma.certificate.findUnique({
          where: { userId_programId: { userId, programId } },
        });
        if (existing) return { certificate: existing };
        // Lost the row to a concurrent revoke/delete between the collision and
        // this lookup — fall through and try again rather than give up.
        continue;
      }

      // certificateNumber or verificationCode collided: retry with fresh
      // values, unless this was the last attempt.
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Could not allocate a unique certificate number after ${MAX_ATTEMPTS} attempts.`
        );
      }
    }
  }

  // Unreachable — the loop always returns or throws — but keeps the function
  // total for TypeScript.
  throw new Error("Failed to create certificate.");
}

/**
 * The columns behind a Prisma unique-constraint violation, or null if the
 * error is something else. `meta.target` is an array of column names on
 * Postgres.
 */
function uniqueConstraintTarget(err: unknown): string[] | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (err.code !== "P2002") return null;
  const target = err.meta?.target;
  return Array.isArray(target) ? (target as string[]) : null;
}

/**
 * Creates a pending certificate if the program has just been completed.
 * Safe to call after any progress event; does nothing when not warranted.
 *
 * Deliberately never throws: this runs inline inside markLessonComplete,
 * submitQuizAttempt and stage sign-off, and a certificate-numbering hiccup
 * must never turn a trainee's already-saved lesson completion into a failed
 * request. Genuine failures are logged so they are visible without blocking
 * the trainee.
 */
export async function maybeCreateCertificate(userId: string, programId: string) {
  try {
    const result = await createPendingCertificate(userId, programId);
    return "certificate" in result ? result.certificate : null;
  } catch (err) {
    console.error(
      `Failed to create a certificate for user ${userId}, program ${programId}:`,
      err
    );
    return null;
  }
}

/** What still stands between a certificate and being issued. */
export async function issuanceBlockers(certificateId: string): Promise<string[]> {
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    select: { userId: true, programId: true, status: true },
  });
  if (!certificate) return ["That certificate no longer exists."];

  const blockers: string[] = [];
  if (certificate.status === "ISSUED") blockers.push("It has already been issued.");
  if (certificate.status === "REVOKED") blockers.push("It has been revoked.");

  // Re-checked at issue time, not just at creation: a lesson may have been
  // added, or a trainer sign-off withdrawn, since the record was created.
  if (!(await isProgramComplete(certificate.programId, certificate.userId))) {
    blockers.push("The trainee has not completed every published stage of this program.");
  }

  return blockers;
}

export type IssueResult = { ok: true; certificate: Certificate } | { ok: false; error: string };

/** A trainer or admin signs the certificate off. */
export async function issueCertificate(
  certificateId: string,
  issuedById: string,
): Promise<IssueResult> {
  const blockers = await issuanceBlockers(certificateId);
  if (blockers.length > 0) return { ok: false, error: blockers.join(" ") };

  const certificate = await prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "ISSUED", issuedAt: new Date(), issuedById, revokedAt: null, revokedReason: null },
  });
  return { ok: true, certificate };
}

/** Withdraws an issued certificate, keeping the record and the reason. */
export async function revokeCertificate(
  certificateId: string,
  reason: string,
): Promise<IssueResult> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Give a reason for revoking this certificate." };

  const existing = await prisma.certificate.findUnique({
    where: { id: certificateId },
    select: { status: true },
  });
  if (!existing) return { ok: false, error: "That certificate no longer exists." };
  if (existing.status !== "ISSUED") {
    return { ok: false, error: "Only an issued certificate can be revoked." };
  }

  const certificate = await prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: trimmed },
  });
  return { ok: true, certificate };
}

/** What a certificate looks like to someone checking it by its code. */
export type VerificationResult =
  | {
      found: true;
      status: CertificateStatus;
      certificateNumber: string;
      traineeName: string;
      programTitle: string;
      issuingOrganisation: string;
      completedAt: Date;
      issuedAt: Date | null;
      revokedAt: Date | null;
    }
  | { found: false };

/**
 * Looks a certificate up by its verification code.
 *
 * Only ever exposes what is printed on the certificate itself — no email
 * address, no user id, no progress detail — because whoever holds the code is
 * not necessarily anyone this system knows.
 */
export async function verifyCertificate(code: string): Promise<VerificationResult> {
  const trimmed = code.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(trimmed)) return { found: false };

  const certificate = await prisma.certificate.findUnique({
    where: { verificationCode: trimmed },
    select: {
      status: true,
      certificateNumber: true,
      traineeName: true,
      programTitle: true,
      issuingOrganisation: true,
      completedAt: true,
      issuedAt: true,
      revokedAt: true,
    },
  });
  if (!certificate) return { found: false };

  // A certificate that was never issued is not a certificate to the outside
  // world, so it verifies as not found rather than as pending.
  if (certificate.status === "PENDING_APPROVAL") return { found: false };

  return { found: true, ...certificate };
}
