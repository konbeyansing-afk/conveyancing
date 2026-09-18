-- CreateEnum
CREATE TYPE "TrainingJurisdiction" AS ENUM ('QLD', 'NSW', 'VIC', 'UK');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "jurisdiction" "TrainingJurisdiction";
