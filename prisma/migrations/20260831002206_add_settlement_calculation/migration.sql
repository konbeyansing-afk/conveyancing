-- CreateEnum
CREATE TYPE "SettlementCalculationStatus" AS ENUM ('DRAFT', 'FINALISED');

-- CreateTable
CREATE TABLE "SettlementCalculation" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "SettlementCalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "jurisdiction" "Jurisdiction" NOT NULL,
    "state" JSONB NOT NULL,
    "settlementAmountCents" INTEGER,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "finalisedAt" TIMESTAMP(3),
    "finalisedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SettlementCalculation_workItemId_status_idx" ON "SettlementCalculation"("workItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementCalculation_workItemId_version_key" ON "SettlementCalculation"("workItemId", "version");

-- AddForeignKey
ALTER TABLE "SettlementCalculation" ADD CONSTRAINT "SettlementCalculation_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementCalculation" ADD CONSTRAINT "SettlementCalculation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementCalculation" ADD CONSTRAINT "SettlementCalculation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementCalculation" ADD CONSTRAINT "SettlementCalculation_finalisedById_fkey" FOREIGN KEY ("finalisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
