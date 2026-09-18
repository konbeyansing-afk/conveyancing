/**
 * Password changing, against the real database.
 *
 * There is no self-service password change anywhere in this app — only an
 * admin ever sets a password, including their own. The properties that
 * matter: the stored value is always a bcrypt hash and never the password
 * itself; only an admin can trigger a change; and a reset never reveals or
 * requires the account's existing password.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { assertDatabaseReachable, cleanup, createUser } from "./helpers";
import { prisma } from "@/lib/prisma";

const session: { user: { id: string; name: string; email: string; role: string } | null } = {
  user: null,
};

vi.mock("@/auth", () => ({
  auth: async () => (session.user ? { user: session.user } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { resetUserPassword, setUserPassword, createUser: createUserAction } = await import(
  "@/lib/actions/users"
);

const START_PASSWORD = "Marlowe-Street-4482";
const NEW_PASSWORD = "Kestrel-Parade-9917";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

type Fixture = Awaited<ReturnType<typeof makeUser>>;

async function makeUser(role: "ADMIN" | "TRAINER" | "TRAINEE", tag: string, password: string) {
  const user = await createUser(role, tag);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  return user;
}

const asUser = (u: Fixture | null, role = "TRAINEE") => {
  session.user = u ? { id: u.id, name: u.name, email: u.email, role } : null;
};

let trainee: Fixture;
let admin: Fixture;
let other: Fixture;

beforeAll(async () => {
  await assertDatabaseReachable();
  trainee = await makeUser("TRAINEE", "pwd", START_PASSWORD);
  admin = await makeUser("ADMIN", "pwd", START_PASSWORD);
  other = await makeUser("TRAINEE", "pwd-other", START_PASSWORD);
});

afterAll(async () => {
  await cleanup();
});

async function hashOf(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return row!.passwordHash;
}

describe("Admin resetting a password", () => {
  it("refuses a trainee", async () => {
    asUser(trainee, "TRAINEE");
    await expect(resetUserPassword(other.id, null, new FormData())).rejects.toThrow(
      /unauthorized/i,
    );
  });

  it("refuses a trainer", async () => {
    asUser(trainee, "TRAINER");
    await expect(resetUserPassword(other.id, null, new FormData())).rejects.toThrow(
      /unauthorized/i,
    );
  });

  it("refuses an anonymous caller", async () => {
    asUser(null);
    await expect(resetUserPassword(other.id, null, new FormData())).rejects.toThrow(
      /unauthorized/i,
    );
  });

  it("issues a temporary password that actually works", async () => {
    asUser(admin, "ADMIN");
    const before = await hashOf(other.id);

    const result = await resetUserPassword(other.id, null, new FormData());
    expect(result?.error).toBeUndefined();
    expect(result?.temporaryPassword).toBeTruthy();

    const row = await prisma.user.findUnique({
      where: { id: other.id },
      select: { passwordHash: true },
    });
    expect(row!.passwordHash).not.toBe(before);
    expect(await bcrypt.compare(result!.temporaryPassword!, row!.passwordHash)).toBe(true);
  });

  it("generates a different password each time", async () => {
    asUser(admin, "ADMIN");
    const first = await resetUserPassword(other.id, null, new FormData());
    const second = await resetUserPassword(other.id, null, new FormData());
    expect(first?.temporaryPassword).not.toBe(second?.temporaryPassword);
  });

  it("lets an admin reset their own password too — there is no other way to change it", async () => {
    asUser(admin, "ADMIN");
    const before = await hashOf(admin.id);
    const result = await resetUserPassword(admin.id, null, new FormData());
    expect(result?.error).toBeUndefined();
    expect(result?.temporaryPassword).toBeTruthy();
    expect(await hashOf(admin.id)).not.toBe(before);
  });

  it("reports a user that no longer exists instead of throwing", async () => {
    asUser(admin, "ADMIN");
    const result = await resetUserPassword("does-not-exist", null, new FormData());
    expect(result?.error).toMatch(/no longer exists/i);
  });
});

describe("Admin setting a specific password", () => {
  it("refuses a trainee", async () => {
    asUser(trainee, "TRAINEE");
    await expect(
      setUserPassword(other.id, null, form({ password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })),
    ).rejects.toThrow(/unauthorized/i);
  });

  it("refuses a mismatched confirmation", async () => {
    asUser(admin, "ADMIN");
    const before = await hashOf(other.id);
    const result = await setUserPassword(
      other.id,
      null,
      form({ password: NEW_PASSWORD, confirmPassword: "something-else" }),
    );
    expect(result?.error).toMatch(/do not match/i);
    expect(await hashOf(other.id)).toBe(before);
  });

  it("refuses a weak password", async () => {
    asUser(admin, "ADMIN");
    const result = await setUserPassword(
      other.id,
      null,
      form({ password: "abc", confirmPassword: "abc" }),
    );
    expect(result?.error).toMatch(/at least/i);
  });

  it("sets the chosen password", async () => {
    asUser(admin, "ADMIN");
    const chosen = "Ferndale-Road-7788";
    const result = await setUserPassword(
      other.id,
      null,
      form({ password: chosen, confirmPassword: chosen }),
    );
    expect(result?.error).toBeUndefined();

    const row = await prisma.user.findUnique({
      where: { id: other.id },
      select: { passwordHash: true },
    });
    expect(await bcrypt.compare(chosen, row!.passwordHash)).toBe(true);
  });

  it("lets an admin set their own password too", async () => {
    asUser(admin, "ADMIN");
    const chosen = "Halsworth-Estate-2299";
    const result = await setUserPassword(
      admin.id,
      null,
      form({ password: chosen, confirmPassword: chosen }),
    );
    expect(result?.error).toBeUndefined();
    expect(await bcrypt.compare(chosen, await hashOf(admin.id))).toBe(true);
  });
});

describe("Creating a user", () => {
  it("enforces a minimum length on the temporary password", async () => {
    asUser(admin, "ADMIN");
    const result = await createUserAction(
      null,
      form({
        name: "ZZ-AUDIT Short",
        email: `short.${Date.now()}@example.test`,
        password: "short",
        role: "TRAINEE",
      }),
    );
    expect(result?.error).toMatch(/at least/i);
  });

  it("does not apply the full guessability policy to the temporary password", async () => {
    // Only has to be non-trivial — the admin chose it deliberately and there
    // is no self-service replacement, so the banned-list/name checks that
    // guard a trainee's own chosen password don't apply here.
    asUser(admin, "ADMIN");
    const email = `simple.${Date.now()}@example.test`;
    const result = await createUserAction(
      null,
      form({ name: "ZZ-AUDIT Simple", email, password: "password", role: "TRAINEE" }),
    );
    expect(result).toBeNull();
    const created = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (created) await prisma.user.delete({ where: { id: created.id } });
  });

  it("stores the admin-chosen password hashed, never in the clear", async () => {
    asUser(admin, "ADMIN");
    const email = `fresh.${Date.now()}@example.test`;
    const result = await createUserAction(
      null,
      form({ name: "ZZ-AUDIT Fresh", email, password: "Larkspur-Way-2244", role: "TRAINEE" }),
    );
    expect(result).toBeNull();

    const created = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
    expect(created!.passwordHash).not.toContain("Larkspur");
    expect(await bcrypt.compare("Larkspur-Way-2244", created!.passwordHash)).toBe(true);
    await prisma.user.delete({ where: { id: created!.id } });
  });

  it("refuses a trainee creating a user", async () => {
    asUser(trainee, "TRAINEE");
    await expect(
      createUserAction(
        null,
        form({
          name: "ZZ-AUDIT Nope",
          email: `nope.${Date.now()}@example.test`,
          password: "Larkspur-Way-2244",
          role: "ADMIN",
        }),
      ),
    ).rejects.toThrow(/unauthorized/i);
  });
});
