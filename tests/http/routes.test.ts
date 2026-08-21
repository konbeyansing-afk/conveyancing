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
let traineeId = "";
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

  adminCookie = await login(
    process.env.SEED_ADMIN_EMAIL ?? "admin@conveyancingacademy.local",
    process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
  );
  traineeCookie = await login(trainee.email, TRAINEE_PASSWORD);

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
  "/admin/reports",
  "/admin/resources",
  "/admin/users",
];
const TRAINER_ROUTES = ["/trainer", "/trainer/trainees"];
const TRAINEE_ROUTES = [
  "/app",
  "/app/courses",
  "/app/journey",
  "/app/resources",
  "/app/tools/practice-system",
  "/app/tools/pexa",
  "/app/tools/actionstep",
  "/app/tools/settlement-calculator",
];

describeIfUp()("Unauthenticated access", () => {
  for (const path of [...ADMIN_ROUTES, ...TRAINER_ROUTES, ...TRAINEE_ROUTES]) {
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

  it("sends an admin away from the login page", async () => {
    const res = await get("/login", adminCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin");
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
  }

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
