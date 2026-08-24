import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import { generatePassword, validatePassword } from "../src/lib/password-policy";

try {
  process.loadEnvFile(".env");
} catch {
  // .env not present; rely on already-set environment variables
}

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Creates the first admin account.
 *
 * There is deliberately no default password in this file. Either set
 * SEED_ADMIN_PASSWORD, or let the seed generate a random one and print it once
 * — it is never written anywhere else, and the account is flagged so whoever
 * receives it has to replace it on first sign-in.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@conveyancingacademy.local";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    console.log("Seeding does not touch an existing account's password.");
    console.log(
      "To reset it: sign in and use /account, or have another admin reset it from /admin/users."
    );
    return;
  }

  const supplied = process.env.SEED_ADMIN_PASSWORD;
  if (supplied) {
    const policy = validatePassword(supplied, { email });
    if (!policy.ok) {
      console.error(`SEED_ADMIN_PASSWORD is not acceptable: ${policy.error}`);
      process.exitCode = 1;
      return;
    }
  }

  const password = supplied ?? generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: "Admin",
      email,
      passwordHash,
      role: "ADMIN",
      // Even a password the operator chose has been through a shell history and
      // an env file, so it still has to be replaced by the person using it.
      mustChangePassword: true,
    },
  });

  console.log("Seeded admin user:");
  console.log(`  email:    ${email}`);
  if (supplied) {
    console.log("  password: (the SEED_ADMIN_PASSWORD you supplied)");
  } else {
    console.log(`  password: ${password}`);
    console.log("");
    console.log("This password is shown once and is not stored anywhere in plain text.");
    console.log("Copy it now, then change it at /account after signing in.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
