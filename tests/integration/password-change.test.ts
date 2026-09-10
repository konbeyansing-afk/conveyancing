/**
 * Password changing, against the real database.
 *
 * The properties that matter: the stored value is always a bcrypt hash and
 * never the password itself; a change requires the current password; you can
 * only ever change your own; and an admin reset never reveals or requires the
 * old one.
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

const { changeOwnPassword } = await import("@/lib/actions/account");
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
    data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
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

describe("Changing your own password", () => {
  it("refuses when nobody is signed in", async () => {
    asUser(null);
    const result = await changeOwnPassword(
      null,
      form({
        currentPassword: START_PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    );
    expect(result?.error).toMatch(/not signed in/i);
  });

  it("refuses an incorrect current password, and changes nothing", async () => {
    asUser(trainee);
    const before = await hashOf(trainee.id);

    const result = await changeOwnPassword(
      null,
      form({
        currentPassword: "not-the-right-password",
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    );

    expect(result?.error).toMatch(/current password is not correct/i);
    expect(await hashOf(trainee.id)).toBe(before);
  });

  it("refuses a missing current password", async () => {
    asUser(trainee);
    const result = await changeOwnPassword(
      null,
      form({ currentPassword: "", newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }),
    );
    expect(result?.error).toMatch(/enter your current password/i);
  });

  it("refuses when the confirmation does not match", async () => {
    asUser(trainee);
    const before = await hashOf(trainee.id);

    const result = await changeOwnPassword(
      null,
      form({
        currentPassword: START_PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD + "x",
      }),
    );

    expect(result?.error).toMatch(/do not match/i);
    expect(await hashOf(trainee.id)).toBe(before);
  });

  it("refuses a password that fails the policy", async () => {
    asUser(trainee);
    const before = await hashOf(trainee.id);

    const result = await changeOwnPassword(
      null,
      form({
        currentPassword: START_PASSWORD,
        newPassword: "short1!",
        confirmPassword: "short1!",
      }),
    );

    expect(result?.error).toMatch(/at least/i);
    expect(await hashOf(trainee.id)).toBe(before);
  });

  it("refuses the old seeded default in particular", async () => {
    asUser(trainee);
    const result = await changeOwnPassword(
      null,
      form({
        currentPassword: START_PASSWORD,
        newPassword: "ChangeMe123!",
        confirmPassword: "ChangeMe123!",
      }),
    );
    expect(result?.error).toMatch(/too common/i);
  });

  it("refuses reusing the current password", async () => {
    asUser(trainee);
    const result = await changeOwnPassword(
      null,
      form({
        currentPassword: START_PASSWORD,
        newPassword: START_PASSWORD,
        confirmPassword: START_PASSWORD,
      }),
    );
    expect(result?.error).toMatch(/different/i);
  });

  it("changes the password, stores it hashed, and clears the must-change flag", async () => {
    asUser(trainee);
    const before = await hashOf(trainee.id);

    const result = await changeOwnPassword(
      null,
      form({
        currentPassword: START_PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    );
    expect(result?.success).toBe(true);
    expect(result?.error).toBeUndefined();

    const row = await prisma.user.findUnique({
      where: { id: trainee.id },
      select: { passwordHash: true, mustChangePassword: true, passwordChangedAt: true },
    });

    // Stored hashed, never in the clear, and genuinely different.
    expect(row!.passwordHash).not.toBe(before);
    expect(row!.passwordHash).not.toContain(NEW_PASSWORD);
    expect(row!.passwordHash.startsWith("$2")).toBe(true);
    expect(await bcrypt.compare(NEW_PASSWORD, row!.passwordHash)).toBe(true);
    expect(await bcrypt.compare(START_PASSWORD, row!.passwordHash)).toBe(false);

    expect(row!.mustChangePassword).toBe(false);
    expect(row!.passwordChangedAt).not.toBeNull();
  });

  it("returns nothing resembling the password to the caller", async () => {
    asUser(trainee);
    const result = await changeOwnPassword(
      null,
      form({
        currentPassword: NEW_PASSWORD,
        newPassword: "Barrenjoey-Grove-3311",
        confirmPassword: "Barrenjoey-Grove-3311",
      }),
    );
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("Barrenjoey");
    expect(serialised).not.toContain(NEW_PASSWORD);
  });

  it("only ever affects the signed-in user", async () => {
    const otherBefore = await hashOf(other.id);
    asUser(trainee);
    await changeOwnPassword(
      null,
      form({
        currentPassword: "Barrenjoey-Grove-3311",
        newPassword: "Wenlock-Close-5521",
        confirmPassword: "Wenlock-Close-5521",
      }),
    );
    expect(await hashOf(other.id)).toBe(otherBefore);
  });
});

describe("Admin resetting someone else's password", () => {
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

  it("issues a temporary password that actually works and forces a change", async () => {
    asUser(admin, "ADMIN");
    const before = await hashOf(other.id);

    const result = await resetUserPassword(other.id, null, new FormData());
    expect(result?.error).toBeUndefined();
    expect(result?.temporaryPassword).toBeTruthy();

    const row = await prisma.user.findUnique({
      where: { id: other.id },
      select: { passwordHash: true, mustChangePassword: true },
    });
    expect(row!.passwordHash).not.toBe(before);
    expect(await bcrypt.compare(result!.temporaryPassword!, row!.passwordHash)).toBe(true);
    expect(row!.mustChangePassword).toBe(true);
  });

  it("generates a different password each time", async () => {
    asUser(admin, "ADMIN");
    const first = await resetUserPassword(other.id, null, new FormData());
    const second = await resetUserPassword(other.id, null, new FormData());
    expect(first?.temporaryPassword).not.toBe(second?.temporaryPassword);
  });

  it("will not let an admin reset their own password this way", async () => {
    asUser(admin, "ADMIN");
    const before = await hashOf(admin.id);
    const result = await resetUserPassword(admin.id, null, new FormData());
    expect(result?.error).toMatch(/account page/i);
    expect(await hashOf(admin.id)).toBe(before);
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

  it("sets the password and forces a change", async () => {
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
      select: { passwordHash: true, mustChangePassword: true },
    });
    expect(await bcrypt.compare(chosen, row!.passwordHash)).toBe(true);
    expect(row!.mustChangePassword).toBe(true);
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
    // A temporary password only has to be non-trivial — the holder is forced
    // to replace it on first login, so the banned-list / name checks that
    // guard a real password don't apply here.
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

  it("flags a new account so the holder must choose their own password", async () => {
    asUser(admin, "ADMIN");
    const email = `fresh.${Date.now()}@example.test`;
    const result = await createUserAction(
      null,
      form({ name: "ZZ-AUDIT Fresh", email, password: "Larkspur-Way-2244", role: "TRAINEE" }),
    );
    expect(result).toBeNull();

    const created = await prisma.user.findUnique({
      where: { email },
      select: { id: true, mustChangePassword: true, passwordHash: true },
    });
    expect(created!.mustChangePassword).toBe(true);
    expect(created!.passwordHash).not.toContain("Larkspur");
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
