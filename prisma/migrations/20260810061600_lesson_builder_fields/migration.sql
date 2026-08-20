-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('STANDARD', 'VIDEO', 'READING', 'PRACTICAL', 'QUIZ', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "description" TEXT,
ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lessonType" "LessonType" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "LessonAttachment" ALTER COLUMN "sizeBytes" DROP NOT NULL;

-- DataMigration: lessons created before per-lesson publishing existed were implicitly
-- visible to trainees whenever their course was published. Preserve that behavior for
-- existing lessons; only lessons created after this migration default to Draft.
UPDATE "Lesson" SET "isPublished" = true;
