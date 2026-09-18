import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

try {
  process.loadEnvFile(".env");
} catch {
  // .env not present; rely on already-set environment variables
}

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * One-off backfill for Program.jurisdiction, added because the training
 * catalogue already has real QLD/NSW/VIC/UK programs but nothing had ever
 * recorded which is which. Classified from each program's own title — never
 * a guess — so a program whose title doesn't name a jurisdiction (e.g.
 * "Company Onboarding") is deliberately left null rather than assigned one.
 *
 * Safe to re-run: idempotent, and a newly added program just needs its title
 * (or this map) updated and the script run again.
 */
const JURISDICTION_BY_TITLE: Record<string, "QLD" | "NSW" | "VIC" | "UK"> = {
  "QLD Conveyancing": "QLD",
  "QLD Conveyancing VA Academy": "QLD",
  "QLD Conveyancing Training Program": "QLD",
  "Phase 4A — Queensland Process (Matter Opening to Search Ordering)": "QLD",
  "Phase 4B — Queensland Process (Conditions to Post-Settlement)": "QLD",
  "Phase 3B — Conveyancing Fundamentals (Queensland Process & Terminology)": "QLD",
  "NSW Conveyancing VA Academy": "NSW",
  "Victoria Conveyancing VA Academy": "VIC",
  "UK Conveyancing VA Academy (England & Wales)": "UK",
};

async function main() {
  const programs = await prisma.program.findMany({ select: { id: true, title: true, jurisdiction: true } });

  let updated = 0;
  let skipped = 0;
  for (const program of programs) {
    const jurisdiction = JURISDICTION_BY_TITLE[program.title];
    if (!jurisdiction) {
      console.log(`Leaving null (no jurisdiction in its title): ${program.title}`);
      skipped++;
      continue;
    }
    if (program.jurisdiction === jurisdiction) {
      console.log(`Already ${jurisdiction}: ${program.title}`);
      continue;
    }
    await prisma.program.update({ where: { id: program.id }, data: { jurisdiction } });
    console.log(`Set ${jurisdiction}: ${program.title}`);
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${skipped} left null, ${programs.length} programs total.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
