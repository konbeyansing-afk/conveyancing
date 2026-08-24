-- CreateTable
CREATE TABLE "TraineeNote" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraineeNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraineeNote_traineeId_createdAt_idx" ON "TraineeNote"("traineeId", "createdAt");

-- AddForeignKey
ALTER TABLE "TraineeNote" ADD CONSTRAINT "TraineeNote_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeNote" ADD CONSTRAINT "TraineeNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

