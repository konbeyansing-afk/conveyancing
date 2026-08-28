// One-off script: creates 4 synthetic demo matters (QLD Purchaser, QLD
// Vendor, NSW Purchaser, NSW Vendor) with fully instantiated checklists,
// for manual self-testing of the checklist system. All names/addresses/
// matter numbers are entirely fictional. Run once with tsx, then discard —
// not part of the app's build.
process.loadEnvFile(".env");

async function main() {
  // Dynamic imports: prisma.ts reads DATABASE_URL at module-evaluation time,
  // and ESM import statements are hoisted above loadEnvFile above — a static
  // import here would run before the env var is set.
  const { prisma } = await import("../src/lib/prisma");
  const { checklistTemplate } = await import("../src/lib/checklist-templates");
  const va = await prisma.user.findFirstOrThrow({ where: { role: "VA" }, orderBy: { createdAt: "asc" } });
  console.log("Seeding demo matters for VA:", va.name);

  const matters: {
    title: string;
    matterReference: string;
    clientReference: string;
    jurisdiction: "QLD" | "NSW";
    matterType: "PURCHASE" | "SALE";
    completeFirstStage?: boolean;
  }[] = [
    {
      title: "Demo — 14 Fictus Street, Rivergrove QLD 4000",
      matterReference: "DEMO-QP-0001",
      clientReference: "A. Fictional Buyer",
      jurisdiction: "QLD",
      matterType: "PURCHASE",
      completeFirstStage: true,
    },
    {
      title: "Demo — 22 Sample Avenue, Coastview QLD 4210",
      matterReference: "DEMO-QV-0002",
      clientReference: "B. Sample Seller",
      jurisdiction: "QLD",
      matterType: "SALE",
    },
    {
      title: "Demo — 7 Testcase Lane, Harbourfield NSW 2000",
      matterReference: "DEMO-NP-0003",
      clientReference: "C. Example Buyer",
      jurisdiction: "NSW",
      matterType: "PURCHASE",
    },
    {
      title: "Demo — 101 Placeholder Road, Meadowbrook NSW 2210",
      matterReference: "DEMO-NV-0004",
      clientReference: "D. Placeholder Seller",
      jurisdiction: "NSW",
      matterType: "SALE",
    },
  ];

  for (const m of matters) {
    const existing = await prisma.workItem.findFirst({ where: { userId: va.id, matterReference: m.matterReference } });
    if (existing) {
      console.log("Already exists, skipping:", m.matterReference);
      continue;
    }
    const item = await prisma.workItem.create({
      data: {
        userId: va.id,
        title: m.title,
        matterReference: m.matterReference,
        clientReference: m.clientReference,
        jurisdiction: m.jurisdiction,
        matterType: m.matterType,
        status: "IN_PROGRESS",
        priority: "NORMAL",
      },
    });

    const template = checklistTemplate(m.jurisdiction, m.matterType);
    await prisma.checklistTask.createMany({
      data: template.map((t) => ({ workItemId: item.id, taskKey: t.key })),
    });

    if (m.completeFirstStage) {
      const openingKeys = template.filter((t) => t.stage === "MATTER_OPENING").map((t) => t.key);
      await prisma.checklistTask.updateMany({
        where: { workItemId: item.id, taskKey: { in: openingKeys } },
        data: { status: "COMPLETED", completedAt: new Date(), completedById: va.id },
      });
    }

    console.log("Created:", m.matterReference, "-", template.length, "checklist tasks");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
