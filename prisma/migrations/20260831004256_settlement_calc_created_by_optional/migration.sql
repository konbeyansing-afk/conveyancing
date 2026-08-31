-- DropForeignKey
ALTER TABLE "SettlementCalculation" DROP CONSTRAINT "SettlementCalculation_createdById_fkey";

-- AlterTable
ALTER TABLE "SettlementCalculation" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SettlementCalculation" ADD CONSTRAINT "SettlementCalculation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
