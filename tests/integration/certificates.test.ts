/**
 * Certificate lifecycle: program complete → PENDING_APPROVAL → ISSUED →
 * REVOKED.
 *
 * The properties under test: a certificate never exists for an incomplete
 * program, never issues itself, re-checks completion at the moment of issue,
 * and verifies to the outside world only once a human has signed it off.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertDatabaseReachable,
  cleanup,
  completeLesson,
  createCourseWithLessons,
  createProgram,
  createStage,
  createUser,
  enrol,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const session: { user: { id: string; name: string; email: string; role: string } | null } = {
  user: null,
};
vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { markLessonComplete } = await import("@/lib/actions/progress");
const {
  checkEligibility,
  createPendingCertificate,
  issueCertificate,
  revokeCertificate,
  verifyCertificate,
  issuanceBlockers,
} = await import("@/lib/certificates");
const { issueCertificateAction, revokeCertificateAction, claimCertificateAction } = await import(
  "@/lib/actions/certificates"
);

type User = Awaited<ReturnType<typeof createUser>>;
let trainee: User;
let admin: User;
let trainer: User;
let outsider: User;

const asUser = (u: User | null, role = "TRAINEE") => {
  session.user = u ? { id: u.id, name: u.name, email: u.email, role } : null;
};

beforeAll(async () => {
  await assertDatabaseReachable();
  trainee = await createUser("TRAINEE", "cert");
  admin = await createUser("ADMIN", "cert");
  trainer = await createUser("TRAINER", "cert");
  outsider = await createUser("TRAINEE", "cert-outsider");
});

afterAll(async () => {
  await cleanup();
});

/** A one-stage, one-lesson program the trainee is enrolled in but has not finished. */
async function makeProgramFor(userId: string, title: string, lessonCount = 1) {
  const program = await createProgram({ isPublished: true });
  const stage = await createStage(program.id, { order: 0, title: `${title} Stage` });
  const course = await createCourseWithLessons(program.id, stage.id, {
    title: `${title} Course`,
    lessonCount,
  });
  await enrol(userId, course.id);
  return { program, stage, course, lessons: course.modules[0].lessons };
}

async function makeProgram(title: string, lessonCount = 1) {
  return makeProgramFor(trainee.id, title, lessonCount);
}

async function finish(lessons: { id: string }[]) {
  asUser(trainee);
  for (const lesson of lessons) await markLessonComplete(lesson.id);
}

describe("Eligibility", () => {
  it("refuses a trainee who is not enrolled", async () => {
    const { program } = await makeProgram("Unenrolled");
    expect(await checkEligibility(outsider.id, program.id)).toEqual({
      eligible: false,
      reason: "not_enrolled",
    });
  });

  it("refuses an incomplete program", async () => {
    const { program } = await makeProgram("Incomplete", 2);
    expect(await checkEligibility(trainee.id, program.id)).toEqual({
      eligible: false,
      reason: "program_incomplete",
    });
  });

  it("allows a completed program", async () => {
    const { program, lessons } = await makeProgram("Eligible");
    await finish(lessons);
    // Completing the program already created the record, so eligibility now
    // reports that rather than inventing a second one.
    const result = await checkEligibility(trainee.id, program.id);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe("already_exists");
  });
});

describe("Creating the record", () => {
  it("creates nothing while the program is unfinished", async () => {
    const { program, lessons } = await makeProgram("Partial", 2);
    await finish([lessons[0]]);

    expect(
      await prisma.certificate.findUnique({
        where: { userId_programId: { userId: trainee.id, programId: program.id } },
      }),
    ).toBeNull();

    const result = await createPendingCertificate(trainee.id, program.id);
    expect("error" in result).toBe(true);
    if ("error" in result && !result.error.eligible) {
      expect(result.error.reason).toBe("program_incomplete");
    }
  });

  it("creates a pending certificate the moment the program completes", async () => {
    const { program, lessons } = await makeProgram("Auto");
    await finish(lessons);

    const certificate = await prisma.certificate.findUnique({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    expect(certificate).not.toBeNull();
    expect(certificate!.status).toBe("PENDING_APPROVAL");
    expect(certificate!.issuedAt).toBeNull();
    expect(certificate!.issuedById).toBeNull();
  });

  it("snapshots the trainee name, program title and organisation", async () => {
    const { program, lessons } = await makeProgram("Snapshot");
    await finish(lessons);

    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    expect(certificate.traineeName).toBe(trainee.name);
    expect(certificate.programTitle).toBe(program.title);
    expect(certificate.issuingOrganisation).toBeTruthy();

    // Renaming the program afterwards must not rewrite the certificate.
    await prisma.program.update({
      where: { id: program.id },
      data: { title: "ZZ-AUDIT Renamed After Issue" },
    });
    const after = await prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
    expect(after.programTitle).toBe(program.title);
  });

  it("gives every certificate a unique number and verification code", { timeout: 60_000 }, async () => {
    const first = await makeProgram("Unique One");
    await finish(first.lessons);
    const second = await makeProgram("Unique Two");
    await finish(second.lessons);

    const certificates = await prisma.certificate.findMany({
      where: { userId: trainee.id },
      select: { certificateNumber: true, verificationCode: true },
    });
    expect(certificates.length).toBeGreaterThanOrEqual(2);
    expect(new Set(certificates.map((c) => c.certificateNumber)).size).toBe(certificates.length);
    expect(new Set(certificates.map((c) => c.verificationCode)).size).toBe(certificates.length);
    for (const c of certificates) {
      expect(c.certificateNumber).toMatch(/^CA-\d{4}-\d{6}$/);
      expect(c.verificationCode).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("never hands out the same certificate number to two truly concurrent completions", async () => {
    // Regression: certificateNumber used to be allocated by reading the
    // current highest number and adding one — two calls close enough
    // together could read the same "current highest" and compute the same
    // next number. Sequential awaits (as in the test above) never exercise
    // that window.
    //
    // This calls createPendingCertificate directly rather than going through
    // markLessonComplete: that action reads the signed-in user off the
    // mocked auth() session, and this file's mock is one shared mutable
    // `session.user` — genuinely concurrent Promise.all calls would race on
    // *that*, which is a limitation of the test double, not of the app. Going
    // straight to the function under test (which takes userId as an explicit
    // argument and never touches auth()) isolates exactly the thing this
    // regression is about: number allocation under real concurrency.
    const CONCURRENT = 8;
    const setups = await Promise.all(
      Array.from({ length: CONCURRENT }, async (_, i) => {
        const t = await createUser("TRAINEE", `concurrent-cert-${i}`);
        const { program, lessons } = await makeProgramFor(t.id, `Concurrent ${i}`);
        for (const lesson of lessons) await completeLesson(t.id, lesson.id);
        return { trainee: t, program };
      }),
    );

    const results = await Promise.all(
      setups.map(({ trainee: t, program }) => createPendingCertificate(t.id, program.id)),
    );
    const certificateNumbers = results.map((r) => {
      if (!("certificate" in r)) throw new Error(`expected a certificate, got ${JSON.stringify(r)}`);
      return r.certificate.certificateNumber;
    });

    expect(certificateNumbers).toHaveLength(CONCURRENT);
    expect(new Set(certificateNumbers).size).toBe(CONCURRENT);
  });

  it("does not create a second certificate for the same program", async () => {
    const { program, lessons } = await makeProgram("Once Only");
    await finish(lessons);
    await createPendingCertificate(trainee.id, program.id);
    await createPendingCertificate(trainee.id, program.id);

    expect(
      await prisma.certificate.count({ where: { userId: trainee.id, programId: program.id } }),
    ).toBe(1);
  });

  it("records the completion date from the milestone, not the moment of creation", async () => {
    const { program, lessons } = await makeProgram("Dated");
    await finish(lessons);

    const [certificate, milestone] = await Promise.all([
      prisma.certificate.findUniqueOrThrow({
        where: { userId_programId: { userId: trainee.id, programId: program.id } },
      }),
      prisma.completionRecord.findFirstOrThrow({
        where: { userId: trainee.id, scope: "PROGRAM", programId: program.id },
      }),
    ]);
    expect(certificate.completedAt.getTime()).toBe(milestone.completedAt.getTime());
  });
});

describe("Issuing", () => {
  it("does not issue itself when the program completes", async () => {
    const { program, lessons } = await makeProgram("Not Auto Issued");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    expect(certificate.status).toBe("PENDING_APPROVAL");
  });

  it("issues on a trainer's sign-off and stamps who and when", async () => {
    const { program, lessons } = await makeProgram("Issuable");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });

    const result = await issueCertificate(certificate.id, admin.id);
    expect(result.ok).toBe(true);

    const issued = await prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
    expect(issued.status).toBe("ISSUED");
    expect(issued.issuedById).toBe(admin.id);
    expect(issued.issuedAt).not.toBeNull();
  });

  it("re-checks completion at issue time, not just at creation", async () => {
    const { program, course, lessons } = await makeProgram("Regressed");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });

    // The admin publishes more required work after the record was created.
    await prisma.lesson.create({
      data: {
        moduleId: course.modules[0].id,
        title: "ZZ-AUDIT added before issue",
        slug: `zz-audit-preissue-${Date.now()}`,
        order: 9,
        isPublished: true,
      },
    });

    const blockers = await issuanceBlockers(certificate.id);
    expect(blockers.join(" ")).toMatch(/not completed every published stage/i);

    const result = await issueCertificate(certificate.id, admin.id);
    expect(result.ok).toBe(false);
    expect(
      (await prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } })).status,
    ).toBe("PENDING_APPROVAL");
  });

  it("refuses to issue the same certificate twice", async () => {
    const { program, lessons } = await makeProgram("Twice");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });

    expect((await issueCertificate(certificate.id, admin.id)).ok).toBe(true);
    const second = await issueCertificate(certificate.id, admin.id);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/already been issued/i);
  });
});

describe("Revoking", () => {
  it("revokes an issued certificate, keeping the record and the reason", async () => {
    const { program, lessons } = await makeProgram("Revokable");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    await issueCertificate(certificate.id, admin.id);

    const result = await revokeCertificate(certificate.id, "Issued against the wrong program.");
    expect(result.ok).toBe(true);

    const revoked = await prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.revokedReason).toMatch(/wrong program/i);
    expect(revoked.revokedAt).not.toBeNull();
    // The record is kept, not deleted.
    expect(revoked.certificateNumber).toBe(certificate.certificateNumber);
  });

  it("requires a reason", async () => {
    const { program, lessons } = await makeProgram("Reasonless");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    await issueCertificate(certificate.id, admin.id);

    const result = await revokeCertificate(certificate.id, "   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/reason/i);
  });

  it("will not revoke something that was never issued", async () => {
    const { program, lessons } = await makeProgram("Never Issued");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });

    const result = await revokeCertificate(certificate.id, "Because.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/only an issued certificate/i);
  });
});

describe("Verification", () => {
  it("verifies an issued certificate by its code", async () => {
    const { program, lessons } = await makeProgram("Verifiable");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    await issueCertificate(certificate.id, admin.id);

    const result = await verifyCertificate(certificate.verificationCode);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.certificateNumber).toBe(certificate.certificateNumber);
      expect(result.traineeName).toBe(trainee.name);
      expect(result.status).toBe("ISSUED");
    }
  });

  it("does not verify a certificate that has not been signed off", async () => {
    const { program, lessons } = await makeProgram("Unverifiable");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    expect(await verifyCertificate(certificate.verificationCode)).toEqual({ found: false });
  });

  it("shows a revoked certificate as revoked rather than hiding it", async () => {
    const { program, lessons } = await makeProgram("Revoked Verify");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    await issueCertificate(certificate.id, admin.id);
    await revokeCertificate(certificate.id, "Superseded.");

    const result = await verifyCertificate(certificate.verificationCode);
    expect(result.found).toBe(true);
    if (result.found) expect(result.status).toBe("REVOKED");
  });

  it("leaks nothing beyond what is printed on the certificate", async () => {
    const { program, lessons } = await makeProgram("No Leak");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    await issueCertificate(certificate.id, admin.id);

    const result = await verifyCertificate(certificate.verificationCode);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain(trainee.email);
    expect(serialised).not.toContain(trainee.id);
    expect(serialised).not.toContain(program.id);
  });

  it("returns not-found for codes that are wrong, malformed or empty", async () => {
    for (const code of ["", "nope", "z".repeat(32), "0".repeat(31), "0".repeat(33)]) {
      expect(await verifyCertificate(code), code).toEqual({ found: false });
    }
  });

  it("accepts a code in any case and with stray whitespace", async () => {
    const { program, lessons } = await makeProgram("Sloppy Code");
    await finish(lessons);
    const certificate = await prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
    await issueCertificate(certificate.id, admin.id);

    const messy = `  ${certificate.verificationCode.toUpperCase()}  `;
    expect((await verifyCertificate(messy)).found).toBe(true);
  });
});

describe("Authorisation on the certificate actions", () => {
  async function pendingCertificateFor(label: string) {
    const { program, lessons } = await makeProgram(label);
    await finish(lessons);
    return prisma.certificate.findUniqueOrThrow({
      where: { userId_programId: { userId: trainee.id, programId: program.id } },
    });
  }

  it("refuses issuing for a trainee", async () => {
    const certificate = await pendingCertificateFor("Authz Trainee");
    asUser(trainee, "TRAINEE");
    await expect(
      issueCertificateAction(certificate.id, null, new FormData()),
    ).rejects.toThrow(/unauthorized/i);
  });

  it("refuses issuing with no session", async () => {
    const certificate = await pendingCertificateFor("Authz Anon");
    asUser(null);
    await expect(
      issueCertificateAction(certificate.id, null, new FormData()),
    ).rejects.toThrow(/unauthorized/i);
  });

  it("refuses a trainer the trainee is not assigned to", async () => {
    const certificate = await pendingCertificateFor("Authz Unassigned");
    asUser(trainer, "TRAINER");
    const result = await issueCertificateAction(certificate.id, null, new FormData());
    expect(result?.error).toMatch(/not assigned to you/i);
    expect(
      (await prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } })).status,
    ).toBe("PENDING_APPROVAL");
  });

  it("allows a trainer the trainee is assigned to", async () => {
    const certificate = await pendingCertificateFor("Authz Assigned");
    await prisma.trainerAssignment.create({
      data: { trainerId: trainer.id, traineeId: trainee.id },
    });

    asUser(trainer, "TRAINER");
    const result = await issueCertificateAction(certificate.id, null, new FormData());
    expect(result?.error).toBeUndefined();
    expect(
      (await prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } })).status,
    ).toBe("ISSUED");

    await prisma.trainerAssignment.deleteMany({ where: { trainerId: trainer.id } });
  });

  it("lets an admin revoke but not a trainer", async () => {
    const certificate = await pendingCertificateFor("Authz Revoke");
    await issueCertificate(certificate.id, admin.id);

    asUser(trainer, "TRAINER");
    await expect(
      revokeCertificateAction(certificate.id, null, new FormData()),
    ).rejects.toThrow(/unauthorized/i);

    asUser(admin, "ADMIN");
    const form = new FormData();
    form.set("reason", "Administrative correction.");
    const result = await revokeCertificateAction(certificate.id, null, form);
    expect(result?.error).toBeUndefined();
  });

  it("only ever claims a certificate for the signed-in trainee", async () => {
    const { program, lessons } = await makeProgram("Claim Scope");
    await finish(lessons);

    // The outsider claiming the same program gets nothing.
    asUser(outsider, "TRAINEE");
    const result = await claimCertificateAction(program.id, null, new FormData());
    expect(result?.error).toMatch(/not enrolled/i);
    expect(await prisma.certificate.count({ where: { userId: outsider.id } })).toBe(0);
  });

  it("refuses a claim with no session", async () => {
    const { program } = await makeProgram("Claim Anon");
    asUser(null);
    const result = await claimCertificateAction(program.id, null, new FormData());
    expect(result?.error).toMatch(/not signed in/i);
  });
});
