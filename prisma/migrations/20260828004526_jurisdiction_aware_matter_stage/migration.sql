-- Jurisdiction + matter type, and a redefined MatterStage enum shaped
-- around a shared identifier set that both QLD and NSW workflows draw from
-- (see src/lib/matter-stage.ts MATTER_WORKFLOWS). Written by hand rather
-- than via `prisma migrate dev` because that command refuses to run
-- non-interactively when it detects a potentially-destructive enum change;
-- this table has no rows using the values being removed (the column was
-- only just added, defaulted to MATTER_OPENING, in the previous migration),
-- so the CASE mapping below is defensive rather than load-bearing.

-- New enums
CREATE TYPE "Jurisdiction" AS ENUM ('QLD', 'NSW');
CREATE TYPE "MatterType" AS ENUM ('PURCHASE', 'SALE');

-- Redefine MatterStage: swap in a new type via the standard
-- create-migrate-drop-rename dance, mapping every old value onto its
-- closest equivalent in the new set.
CREATE TYPE "MatterStage_new" AS ENUM (
  'MATTER_OPENING',
  'CONTRACT_REVIEW',
  'CONTRACT_SIGNED',
  'CONTRACT_EXCHANGE',
  'COOLING_OFF',
  'FINANCE',
  'BUILDING_PEST',
  'SEARCHES',
  'PRE_SETTLEMENT',
  'SETTLEMENT_PREPARATION',
  'SETTLEMENT_BOOKED',
  'SETTLEMENT',
  'POST_SETTLEMENT',
  'LODGEMENT_REGISTRATION',
  'MATTER_FINALISATION',
  'COMPLETED'
);

ALTER TABLE "WorkItem" ALTER COLUMN "matterStage" DROP DEFAULT;
ALTER TABLE "WorkItem" ALTER COLUMN "matterStage" TYPE "MatterStage_new" USING (
  CASE "matterStage"::text
    WHEN 'INITIAL_INSTRUCTIONS' THEN 'MATTER_OPENING'
    WHEN 'FINANCE_APPROVAL' THEN 'FINANCE'
    WHEN 'BUILDING_AND_PEST' THEN 'BUILDING_PEST'
    WHEN 'ADJUSTMENTS' THEN 'PRE_SETTLEMENT'
    WHEN 'SETTLEMENT_READY' THEN 'SETTLEMENT_BOOKED'
    WHEN 'SETTLEMENT_DAY' THEN 'SETTLEMENT'
    WHEN 'SETTLEMENT_COMPLETED' THEN 'SETTLEMENT'
    WHEN 'REGISTRATION_LODGEMENT' THEN 'LODGEMENT_REGISTRATION'
    WHEN 'FINALISATION' THEN 'MATTER_FINALISATION'
    WHEN 'MATTER_CLOSED' THEN 'COMPLETED'
    ELSE "matterStage"::text
  END::"MatterStage_new"
);
ALTER TABLE "WorkItem" ALTER COLUMN "matterStage" SET DEFAULT 'MATTER_OPENING';

-- previousMatterStage/newMatterStage are entirely NULL so far (no action
-- has ever written to them yet) — a plain cast is safe.
ALTER TABLE "WorkActivity" ALTER COLUMN "previousMatterStage" TYPE "MatterStage_new" USING ("previousMatterStage"::text::"MatterStage_new");
ALTER TABLE "WorkActivity" ALTER COLUMN "newMatterStage" TYPE "MatterStage_new" USING ("newMatterStage"::text::"MatterStage_new");

DROP TYPE "MatterStage";
ALTER TYPE "MatterStage_new" RENAME TO "MatterStage";

-- Jurisdiction + matter type on WorkItem
ALTER TABLE "WorkItem" ADD COLUMN "jurisdiction" "Jurisdiction" NOT NULL DEFAULT 'QLD';
ALTER TABLE "WorkItem" ADD COLUMN "matterType" "MatterType";

-- CreateIndex
CREATE INDEX "WorkItem_jurisdiction_deletedAt_idx" ON "WorkItem"("jurisdiction", "deletedAt");
