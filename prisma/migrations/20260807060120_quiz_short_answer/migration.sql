-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'SHORT_ANSWER';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "explanation" TEXT;
