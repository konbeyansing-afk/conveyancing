/**
 * Flags any account still using a password this project once shipped or
 * documented, so the holder is prompted to replace it.
 *
 * It does not change anyone's password — it only sets `mustChangePassword`,
 * which surfaces the banner and the account-page prompt. Safe to re-run.
 *
 *   pnpm exec cross-env NODE_OPTIONS=--use-system-ca tsx scripts/flag-default-passwords.ts
 *
 * Add --dry-run to report without writing.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile(".env");
} catch {
  // rely on already-set environment variables
}

neonConfig.webSocketConstructor = ws;
const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

/** Passwords that have appeared in this repo's docs or seed at some point. */
const KNOWN_DEFAULTS = ["ChangeMe123!", "Password123!", "Welcome123!"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, passwordHash: true, mustChangePassword: true },
    orderBy: { createdAt: "asc" },
  });

  const affected: { email: string; role: string; alreadyFlagged: boolean }[] = [];

  for (const user of users) {
    let matches = false;
    for (const candidate of KNOWN_DEFAULTS) {
      if (await bcrypt.compare(candidate, user.passwordHash)) {
        matches = true;
        break;
      }
    }
    if (!matches) continue;

    affected.push({
      email: user.email,
      role: user.role,
      alreadyFlagged: user.mustChangePassword,
    });

    if (!dryRun && !user.mustChangePassword) {
      await prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true },
      });
    }
  }

  if (affected.length === 0) {
    console.log(`Checked ${users.length} account(s). None is using a known default password.`);
    return;
  }

  console.log(
    `${affected.length} of ${users.length} account(s) still use a known default password:`
  );
  for (const a of affected) {
    console.log(`  ${a.email}  (${a.role})${a.alreadyFlagged ? "  [already flagged]" : ""}`);
  }
  console.log("");
  console.log(
    dryRun
      ? "Dry run — nothing was written."
      : "Flagged. They will be prompted to change it at /account on their next visit."
  );
  console.log("The passwords themselves are unchanged; only the account holder can replace them.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
