-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "stageId" TEXT;

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "prerequisiteStageId" TEXT,
    "requireAllLessons" BOOLEAN NOT NULL DEFAULT true,
    "requireQuizPass" BOOLEAN NOT NULL DEFAULT false,
    "gatingQuizId" TEXT,
    "minQuizScore" INTEGER,
    "requireTrainerApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageApproval" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "StageApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stage_gatingQuizId_key" ON "Stage"("gatingQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_programId_slug_key" ON "Stage"("programId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "StageApproval_stageId_userId_key" ON "StageApproval"("stageId", "userId");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_prerequisiteStageId_fkey" FOREIGN KEY ("prerequisiteStageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_gatingQuizId_fkey" FOREIGN KEY ("gatingQuizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageApproval" ADD CONSTRAINT "StageApproval_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageApproval" ADD CONSTRAINT "StageApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageApproval" ADD CONSTRAINT "StageApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
