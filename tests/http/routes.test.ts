/**
 * Route-level tests against a running dev server.
 *
 * These check the things only a real HTTP round trip can: that the proxy
 * (Next 16's renamed middleware) actually redirects, that a trainee hitting an
 * admin URL by hand is bounced, that every page renders without a 500, and
 * that no error page leaks a stack trace or a connection string.
 *
 * Start the app first (pnpm dev), then: pnpm test:routes
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const TRAINEE_PASSWORD = "audit-only-not-a-real-secret";

/**
 * Probed at module load, not in beforeAll: Vitest decides which describe
 * blocks to collect before any hook runs, so the skip must be known by then.
 */
const serverUp = await (async () => {
  try {
    const res = await fetch(`${BASE}/login`, { redirect: "manual" });
    return res.status < 500;
  } catch {
    return false;
  }
})();

let adminCookie = "";
let traineeCookie = "";
let vaCookie = "";
let trainerCookie = "";
let traineeId = "";
let vaId = "";
let trainerId = "";
let publishedCourseId: string | null = null;
let publishedLessonId: string | null = null;

async function get(path: string, cookie = "") {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
}

/** Auth.js credentials login over HTTP: csrf token, then the callback. */
async function login(email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = (csrfRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

  const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/` });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body,
  });

  const cookies = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter((c) => c.includes("session-token"));
  if (cookies.length === 0) throw new Error(`login failed for ${email} (status ${res.status})`);
  return cookies.join("; ");
}

beforeAll(async () => {
  if (!serverUp) return;

  // A throwaway trainee whose password this suite knows. Removed in afterAll.
  const trainee = await prisma.user.create({
    data: {
      name: "ZZ-AUDIT Route Trainee",
      email: `route.trainee.${Date.now()}@example.test`,
      passwordHash: await bcrypt.hash(TRAINEE_PASSWORD, 10),
      role: "TRAINEE",
    },
  });
  traineeId = trainee.id;

  // A throwaway VA whose password this suite knows. Removed in afterAll.
  const va = await prisma.user.create({
    data: {
      name: "ZZ-AUDIT Route VA",
      email: `route.va.${Date.now()}@example.test`,
      passwordHash: await bcrypt.hash(TRAINEE_PASSWORD, 10),
      role: "VA",
    },
  });
  vaId = va.id;

  // A throwaway Trainer whose password this suite knows. Removed in afterAll.
  const trainerUser = await prisma.user.create({
    data: {
      name: "ZZ-AUDIT Route Trainer",
      email: `route.trainer.${Date.now()}@example.test`,
      passwordHash: await bcrypt.hash(TRAINEE_PASSWORD, 10),
      role: "TRAINER",
    },
  });
  trainerId = trainerUser.id;

  adminCookie = await login(
    process.env.SEED_ADMIN_EMAIL ?? "admin@conveyancingacademy.local",
    process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
  );
  traineeCookie = await login(trainee.email, TRAINEE_PASSWORD);
  vaCookie = await login(va.email, TRAINEE_PASSWORD);
  trainerCookie = await login(trainerUser.email, TRAINEE_PASSWORD);

  // A real published lesson to point the trainee at, if the database has one.
  const lesson = await prisma.lesson.findFirst({
    where: { isPublished: true, module: { course: { isPublished: true } } },
    select: { id: true, module: { select: { courseId: true } } },
  });
  if (lesson) {
    publishedLessonId = lesson.id;
    publishedCourseId = lesson.module.courseId;
  }
});

afterAll(async () => {
  if (traineeId) await prisma.user.deleteMany({ where: { id: traineeId } });
  if (vaId) await prisma.user.deleteMany({ where: { id: vaId } });
  if (trainerId) await prisma.user.deleteMany({ where: { id: trainerId } });
});

const describeIfUp = () => (serverUp ? describe : describe.skip);

if (!serverUp) {
  console.warn(
    `[routes] No server answering at ${BASE} — route tests skipped. Start it with "pnpm dev".`,
  );
}

const ADMIN_ROUTES = [
  "/admin",
  "/admin/programs",
  "/admin/trainees",
  "/admin/assessments",
  "/admin/certificates",
  "/admin/reports",
  "/admin/resources",
  "/admin/work-status",
  "/admin/users",
];
const TRAINER_ROUTES = ["/trainer", "/trainer/trainees"];
const TRAINEE_ROUTES = [
  "/app",
  "/app/courses",
  "/app/journey",
  "/app/certificates",
  "/app/resources",
  "/app/tools/practice-system",
  "/app/tools/pexa",
  "/app/tools/actionstep",
  "/app/tools/settlement-calculator",
];
const VA_ROUTES = ["/va"];

describeIfUp()("Unauthenticated access", () => {
  for (const path of [...ADMIN_ROUTES, ...TRAINER_ROUTES, ...TRAINEE_ROUTES, ...VA_ROUTES]) {
    it(`redirects ${path} to the login page`, async () => {
      const res = await get(path);
      expect(res.status).toBe(307);
      const location = res.headers.get("location") ?? "";
      expect(location).toContain("/login");
      // The requested page is preserved so login can return there.
      expect(location).toContain(encodeURIComponent(path).replace(/%2F/g, "%2F"));
    });
  }

  it("serves the login page itself", async () => {
    const res = await get("/login");
    expect(res.status).toBe(200);
  });
});

describeIfUp()("Admin access", () => {
  for (const path of ADMIN_ROUTES) {
    it(`renders ${path}`, async () => {
      const res = await get(path, adminCookie);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain("Application error");
      expect(html).not.toContain("Internal Server Error");
    });
  }

  it("lets an admin into the trainer area too", async () => {
    for (const path of TRAINER_ROUTES) {
      const res = await get(path, adminCookie);
      expect(res.status, path).toBe(200);
    }
  });

  it("bounces an admin off the VA workspace — it is VA-only, not admin territory", async () => {
    for (const path of VA_ROUTES) {
      const res = await get(path, adminCookie);
      expect(res.status, path).toBe(307);
      expect(res.headers.get("location")).toContain("/admin");
    }
  });

  it("sends an admin away from the login page", async () => {
    const res = await get("/login", adminCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin");
  });
});

describeIfUp()("VA access", () => {
  for (const path of VA_ROUTES) {
    it(`renders ${path}`, async () => {
      const res = await get(path, vaCookie);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain("Application error");
      expect(html).not.toContain("Internal Server Error");
    });
  }

  for (const path of ADMIN_ROUTES) {
    it(`bounces a VA off ${path}`, async () => {
      const res = await get(path, vaCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/va");
    });
  }

  for (const path of TRAINER_ROUTES) {
    it(`bounces a VA off ${path}`, async () => {
      const res = await get(path, vaCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/va");
    });
  }

  it("sends a VA away from the login page", async () => {
    const res = await get("/login", vaCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/va");
  });
});

describeIfUp()("Trainer access", () => {
  for (const path of TRAINER_ROUTES) {
    it(`renders ${path}`, async () => {
      const res = await get(path, trainerCookie);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain("Application error");
      expect(html).not.toContain("Internal Server Error");
    });
  }

  it("lets a trainer into Work Status — the one /admin area they can also reach", async () => {
    const res = await get("/admin/work-status", trainerCookie);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("Application error");
    // Should see their own sidebar chrome, not the full Admin one — the
    // "Trainer workspace" header text itself isn't a reliable substring to
    // assert on: React streams `{roleLabel} workspace` as two text nodes
    // separated by an `<!-- -->` hydration marker, so the literal phrase
    // never appears contiguously in the raw HTML. The nav links prove the
    // same thing more robustly: Admin-only links must be absent.
    expect(html).toContain('href="/trainer"');
    expect(html).not.toContain('href="/admin/users"');
    expect(html).not.toContain('href="/admin/programs"');
  });

  for (const path of ADMIN_ROUTES.filter((p) => p !== "/admin/work-status")) {
    it(`bounces a trainer off ${path}`, async () => {
      const res = await get(path, trainerCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/trainer");
    });
  }

  for (const path of VA_ROUTES) {
    it(`bounces a trainer off ${path}`, async () => {
      const res = await get(path, trainerCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/trainer");
    });
  }

  it("sends a trainer away from the login page", async () => {
    const res = await get("/login", trainerCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/trainer");
  });
});

describeIfUp()("Trainee access", () => {
  for (const path of TRAINEE_ROUTES) {
    it(`renders ${path}`, async () => {
      const res = await get(path, traineeCookie);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain("Application error");
    });
  }

  for (const path of ADMIN_ROUTES) {
    it(`bounces a trainee off ${path}`, async () => {
      const res = await get(path, traineeCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app");
    });
  }

  for (const path of TRAINER_ROUTES) {
    it(`bounces a trainee off ${path}`, async () => {
      const res = await get(path, traineeCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app");
    });
  }

  for (const path of VA_ROUTES) {
    it(`bounces a trainee off ${path}`, async () => {
      const res = await get(path, traineeCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app");
    });
  }

  it("404s a course the trainee is not enrolled in rather than showing it", async () => {
    if (!publishedCourseId) return;
    const res = await get(`/app/courses/${publishedCourseId}`, traineeCookie);
    expect(res.status).toBe(404);
  });

  it("404s a lesson the trainee is not enrolled in", async () => {
    if (!publishedCourseId || !publishedLessonId) return;
    const res = await get(
      `/app/courses/${publishedCourseId}/lessons/${publishedLessonId}`,
      traineeCookie,
    );
    expect(res.status).toBe(404);
  });
});

/** Reads the number shown on a StatCard by finding the value nearest before its label. */
function statCardValue(html: string, label: string): number | null {
  const labelAt = html.indexOf(`>${label}<`);
  if (labelAt === -1) return null;
  const before = html.slice(0, labelAt);
  const values = [...before.matchAll(/>(\d+)<\/p>/g)];
  const last = values.at(-1);
  return last ? Number(last[1]) : null;
}

/**
 * Fetches the page and the live count in a loop until they agree, or gives up.
 *
 * The page render and the count query are two separate round trips, and other
 * suites in this parallelised run are creating and deleting their own
 * ZZ-AUDIT courses and programs the whole time — a real gap between the two
 * reads is expected, not a bug. A genuine double-counting regression fails
 * every attempt identically; a transient race resolves within a retry or two.
 *
 * The retry budget below is deliberately generous (attempts, and a short
 * backoff between them) rather than tight: this file's own suite runs
 * alongside every other suite in the same `pnpm check` pass, and a bigger
 * parallel run just means other suites' create/delete churn takes longer to
 * settle — not that this page is double-counting anything.
 */
async function expectStatCardMatchesLiveCount(
  label: string,
  fetchPage: () => Promise<string>,
  liveCount: () => Promise<number>,
) {
  const ATTEMPTS = 10;
  const BACKOFF_MS = 300;
  let lastShown: number | null = null;
  let lastActual = -1;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS));
    const html = await fetchPage();
    lastShown = statCardValue(html, label);
    lastActual = await liveCount();
    if (lastShown === lastActual) return;
  }
  expect(lastShown, `did not settle after ${ATTEMPTS} attempts`).toBe(lastActual);
}

describeIfUp()("Reported figures match the database", () => {
  it("reports the real number of courses on the Programs page", async () => {
    // Regression: the page summed a per-program count built by concatenating
    // program.courses with program.stages[].courses, which counts every
    // stage-attached course twice.
    await expectStatCardMatchesLiveCount(
      "Total courses",
      async () => (await get("/admin/programs", adminCookie)).text(),
      () => prisma.course.count(),
    );
  });

  it("reports the real number of programs on the Programs page", async () => {
    await expectStatCardMatchesLiveCount(
      "Total programs",
      async () => (await get("/admin/programs", adminCookie)).text(),
      () => prisma.program.count(),
    );
  });
});

describeIfUp()("Admin navigation actually goes somewhere", () => {
  /** Every distinct in-app admin link on a page. */
  function adminLinks(html: string): string[] {
    const found = html.match(/\/admin\/programs\/[a-z0-9]+(?:\/courses\/[a-z0-9]+(?:\/lessons\/[a-z0-9]+)?)?/g) ?? [];
    return [...new Set(found)];
  }

  /**
   * The crawl is a structural regression guard (course.programId vs
   * stage.programId), not an exhaustive link check — a broken mapping breaks
   * *every* course/lesson in the program, not one deep one. With the imported
   * curricula a single program can carry 250+ lesson links; crawling all of
   * them against the dev server takes tens of minutes, so sample a bounded
   * set: every program/course link, plus the first few lessons.
   */
  function sampleLinks(links: string[], maxLessons = 8): string[] {
    const lessons = links.filter((l) => l.includes("/lessons/"));
    const rest = links.filter((l) => !l.includes("/lessons/"));
    return [...rest, ...lessons.slice(0, maxLessons)];
  }

  /** Fetches links a few at a time — serial is too slow, all at once floods the dev server. */
  async function findBroken(links: string[]): Promise<string[]> {
    const broken: string[] = [];
    const BATCH = 6;
    for (let i = 0; i < links.length; i += BATCH) {
      const batch = links.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (link) => ({ link, status: (await get(link, adminCookie)).status })),
      );
      for (const r of results) if (r.status !== 200) broken.push(`${r.status} ${r.link}`);
    }
    return broken;
  }

  it("opens every program from the Programs list", { timeout: 120_000 }, async () => {
    const html = await (await get("/admin/programs", adminCookie)).text();
    const links = adminLinks(html);
    expect(links.length).toBeGreaterThan(0);

    // Audit fixtures from other parallel suites come and go for the whole
    // duration of this crawl (up to 120s) — a link into one of them can be
    // valid the moment the list was fetched and legitimately gone by the time
    // this test gets around to checking it. This test is about the real
    // content library staying reachable, not about a fixture another file
    // happened to be deleting mid-run.
    const auditProgramIds = new Set(
      (
        await prisma.program.findMany({
          where: { title: { startsWith: "ZZ-AUDIT" } },
          select: { id: true },
        })
      ).map((p) => p.id),
    );
    const stableLinks = links.filter((link) => {
      const programId = link.match(/\/admin\/programs\/([a-z0-9]+)/)?.[1];
      return !programId || !auditProgramIds.has(programId);
    });

    expect(await findBroken(stableLinks)).toEqual([]);
  });

  it("opens the courses and lessons linked from a program page", { timeout: 180_000 }, async () => {
    // Regression: the course and lesson pages rejected the request unless
    // `course.programId` matched the URL, but the program page builds its
    // links from the stage's program. Where those disagreed — every course in
    // the journey program, whose courses are owned by shell programs — the
    // admin could not open any of its courses or lessons at all.
    //
    // A broken mapping breaks *every* course/lesson in the program, so this
    // samples rather than crawling all of a now-large library: the programs
    // that actually exhibit the programId/stage-programId split, plus one
    // that doesn't, and only the first few lesson links of each.
    const splitProgramIds = new Set(
      (
        await prisma.course.findMany({
          where: { stage: { isNot: null }, NOT: { title: { startsWith: "ZZ-AUDIT" } } },
          select: { programId: true, stage: { select: { programId: true } } },
        })
      )
        .filter((c) => c.stage && c.stage.programId !== c.programId)
        .map((c) => c.stage!.programId),
    );
    const cleanProgram = await prisma.program.findFirst({
      where: {
        id: { notIn: [...splitProgramIds] },
        stages: { some: { courses: { some: {} } } },
        NOT: { title: { startsWith: "ZZ-AUDIT" } },
      },
      select: { id: true },
    });
    const programIds = [...splitProgramIds, ...(cleanProgram ? [cleanProgram.id] : [])];
    expect(programIds.length).toBeGreaterThan(0);

    const broken: string[] = [];
    for (const programId of programIds) {
      const html = await (await get(`/admin/programs/${programId}`, adminCookie)).text();
      broken.push(...(await findBroken(sampleLinks(adminLinks(html), 5))));
    }
    expect(broken).toEqual([]);
  });

  it("still refuses a course that belongs to neither the program nor its stages", async () => {
    const stray = await prisma.course.findFirst({
      where: { stageId: null },
      select: { id: true, programId: true },
    });
    if (!stray) return;
    const otherProgram = await prisma.program.findFirst({
      where: { id: { not: stray.programId } },
      select: { id: true },
    });
    if (!otherProgram) return;

    const res = await get(`/admin/programs/${otherProgram.id}/courses/${stray.id}`, adminCookie);
    expect(res.status).toBe(404);
  });
});

describeIfUp()("The account page is available to every role", () => {
  it("renders for an admin", async () => {
    expect((await get("/account", adminCookie)).status).toBe(200);
  });

  it("renders for a trainee", async () => {
    expect((await get("/account", traineeCookie)).status).toBe(200);
  });

  it("redirects an anonymous visitor to the login page", async () => {
    const res = await get("/account");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});

describeIfUp()("Certificate verification is public", () => {
  it("serves the verify page without a session", async () => {
    const res = await get("/verify/0123456789abcdef0123456789abcdef");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("No certificate matches this code");
  });

  it("does not leak anything for a malformed code", async () => {
    const html = await (await get("/verify/nonsense")).text();
    expect(html).toContain("No certificate matches this code");
    for (const pattern of [/postgresql:\/\//i, /neondb_owner/i, /PrismaClient/]) {
      expect(html).not.toMatch(pattern);
    }
  });
});

describeIfUp()("Bad and hostile input", () => {
  const badIds = [
    "does-not-exist",
    "00000000-0000-0000-0000-000000000000",
    "%27%20OR%201%3D1--",
    "..%2F..%2Fetc%2Fpasswd",
    "<script>alert(1)</script>",
  ];

  for (const id of badIds) {
    it(`404s an unknown course id (${id.slice(0, 20)})`, async () => {
      const res = await get(`/app/courses/${id}`, traineeCookie);
      expect([404, 400]).toContain(res.status);
    });

    it(`404s an unknown stage id (${id.slice(0, 20)})`, async () => {
      const res = await get(`/app/journey/${id}`, traineeCookie);
      expect([404, 400]).toContain(res.status);
    });

    it(`404s an unknown admin program id (${id.slice(0, 20)})`, async () => {
      const res = await get(`/admin/programs/${id}`, adminCookie);
      expect([404, 400]).toContain(res.status);
    });

    it(`404s an unknown VA id on the work status detail page (${id.slice(0, 20)})`, async () => {
      const res = await get(`/admin/work-status/${id}`, adminCookie);
      expect([404, 400]).toContain(res.status);
    });
  }

  it("404s a real user id that is not a VA (role confusion, not just a missing id)", async () => {
    const res = await get(`/admin/work-status/${traineeId}`, adminCookie);
    expect(res.status).toBe(404);
  });

  it("renders a real VA's work status detail page for an admin", async () => {
    const res = await get(`/admin/work-status/${vaId}`, adminCookie);
    expect(res.status).toBe(200);
  });

  it("does not reflect a script tag back into the page unescaped", async () => {
    const res = await get(`/app/courses/${encodeURIComponent("<script>alert(1)</script>")}`, traineeCookie);
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describeIfUp()("Error pages do not leak internals", () => {
  const leaks = [
    /postgresql:\/\//i,
    /neondb_owner/i,
    /AUTH_SECRET/,
    /DATABASE_URL/,
    /PrismaClientKnownRequestError/,
    /at Object\.<anonymous>/,
    /node_modules[\\/]@prisma/,
  ];

  it("keeps a 404 page free of connection strings and stack traces", async () => {
    const res = await get("/app/courses/does-not-exist", traineeCookie);
    const html = await res.text();
    for (const pattern of leaks) expect(html, String(pattern)).not.toMatch(pattern);
  });

  it("keeps the login page free of secrets", async () => {
    const html = await (await get("/login")).text();
    for (const pattern of leaks) expect(html, String(pattern)).not.toMatch(pattern);
  });

  it("keeps the admin dashboard free of secrets", async () => {
    const html = await (await get("/admin", adminCookie)).text();
    for (const pattern of leaks) expect(html, String(pattern)).not.toMatch(pattern);
  });
});

describeIfUp()("Login", () => {
  it("refuses a wrong password", async () => {
    await expect(
      login(process.env.SEED_ADMIN_EMAIL ?? "admin@conveyancingacademy.local", "wrong-password"),
    ).rejects.toThrow(/login failed/);
  });

  it("refuses an unknown email", async () => {
    await expect(login("nobody.at.all@example.test", "whatever")).rejects.toThrow(/login failed/);
  });

  it("does not say whether the email or the password was wrong", async () => {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const csrfCookie = (csrfRes.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const attempt = async (email: string, password: string) => {
      const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
        body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/` }),
      });
      return res.headers.get("location") ?? "";
    };

    const unknownUser = await attempt("nobody.at.all@example.test", "whatever");
    const wrongPassword = await attempt(
      process.env.SEED_ADMIN_EMAIL ?? "admin@conveyancingacademy.local",
      "wrong-password",
    );
    // Same outcome either way — no user enumeration.
    expect(unknownUser.replace(/[?&]callbackUrl=[^&]*/, "")).toBe(
      wrongPassword.replace(/[?&]callbackUrl=[^&]*/, ""),
    );
  });

  it("issues an httpOnly session cookie", async () => {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const csrfCookie = (csrfRes.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .join("; ");
    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
      body: new URLSearchParams({
        csrfToken,
        email: process.env.SEED_ADMIN_EMAIL ?? "admin@conveyancingacademy.local",
        password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
        callbackUrl: `${BASE}/`,
      }),
    });
    const sessionCookie = (res.headers.getSetCookie?.() ?? []).find((c) =>
      c.includes("session-token"),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.toLowerCase()).toContain("httponly");
    expect(sessionCookie!.toLowerCase()).toContain("samesite=lax");
  });

  it("does not accept a forged session cookie", async () => {
    const res = await get("/admin", "authjs.session-token=not-a-real-token");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
