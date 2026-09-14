-- CreateEnum
CREATE TYPE "SignOffResult" AS ENUM ('PASS', 'REFER');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "requiresSignOff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LessonSignOff" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "traineeName" TEXT,
    "traineeSignedAt" TIMESTAMP(3),
    "trainerName" TEXT,
    "trainerResult" "SignOffResult",
    "trainerById" TEXT,
    "trainerNotes" TEXT,
    "trainerSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonSignOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonSignOff_lessonId_userId_key" ON "LessonSignOff"("lessonId", "userId");

-- AddForeignKey
ALTER TABLE "LessonSignOff" ADD CONSTRAINT "LessonSignOff_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSignOff" ADD CONSTRAINT "LessonSignOff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSignOff" ADD CONSTRAINT "LessonSignOff_trainerById_fkey" FOREIGN KEY ("trainerById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
