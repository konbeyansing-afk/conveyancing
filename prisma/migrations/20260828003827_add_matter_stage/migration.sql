-- CreateEnum
CREATE TYPE "MatterStage" AS ENUM ('MATTER_OPENING', 'INITIAL_INSTRUCTIONS', 'CONTRACT_REVIEW', 'CONTRACT_SIGNED', 'CONTRACT_EXCHANGE', 'COOLING_OFF', 'FINANCE_APPROVAL', 'BUILDING_AND_PEST', 'SEARCHES', 'ADJUSTMENTS', 'SETTLEMENT_PREPARATION', 'SETTLEMENT_BOOKED', 'SETTLEMENT_READY', 'SETTLEMENT_DAY', 'SETTLEMENT_COMPLETED', 'POST_SETTLEMENT', 'REGISTRATION_LODGEMENT', 'FINALISATION', 'MATTER_CLOSED');

-- AlterTable
ALTER TABLE "WorkActivity" ADD COLUMN     "newMatterStage" "MatterStage",
ADD COLUMN     "previousMatterStage" "MatterStage";

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN     "matterStage" "MatterStage" NOT NULL DEFAULT 'MATTER_OPENING';

-- CreateIndex
CREATE INDEX "WorkItem_userId_matterStage_idx" ON "WorkItem"("userId", "matterStage");

-- CreateIndex
CREATE INDEX "WorkItem_matterStage_deletedAt_idx" ON "WorkItem"("matterStage", "deletedAt");
