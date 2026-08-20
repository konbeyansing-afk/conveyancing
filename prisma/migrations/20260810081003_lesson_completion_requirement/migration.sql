-- CreateEnum
CREATE TYPE "CompletionRequirement" AS ENUM ('VIEW_ALL', 'PASS_QUIZ');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "completionRequirement" "CompletionRequirement" NOT NULL DEFAULT 'VIEW_ALL';
