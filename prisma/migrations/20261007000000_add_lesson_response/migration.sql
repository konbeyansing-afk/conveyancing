-- CreateTable
CREATE TABLE "LessonResponse" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonResponse_userId_idx" ON "LessonResponse"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonResponse_lessonId_userId_fieldKey_key" ON "LessonResponse"("lessonId", "userId", "fieldKey");

-- AddForeignKey
ALTER TABLE "LessonResponse" ADD CONSTRAINT "LessonResponse_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonResponse" ADD CONSTRAINT "LessonResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
