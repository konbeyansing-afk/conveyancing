-- AlterTable
-- Additive only: every new column is nullable or has a constant default, so rows
-- already stored are untouched and code written before this migration keeps working.
ALTER TABLE "LessonResponse" ADD COLUMN     "fieldId" TEXT,
ADD COLUMN     "legacyKey" TEXT,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "position" INTEGER,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "section" TEXT;
