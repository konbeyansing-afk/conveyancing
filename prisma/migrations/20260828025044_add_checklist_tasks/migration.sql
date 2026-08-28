-- CreateEnum
CREATE TYPE "ChecklistTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING_PENDING', 'BLOCKED', 'COMPLETED', 'NOT_APPLICABLE');

-- AlterEnum
ALTER TYPE "MatterStage" ADD VALUE 'PEXA';

-- CreateTable
CREATE TABLE "ChecklistTask" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "status" "ChecklistTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "blockedReason" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "WorkPriority",
    "assignedToId" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTask_workItemId_status_idx" ON "ChecklistTask"("workItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTask_workItemId_taskKey_key" ON "ChecklistTask"("workItemId", "taskKey");

-- AddForeignKey
ALTER TABLE "ChecklistTask" ADD CONSTRAINT "ChecklistTask_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTask" ADD CONSTRAINT "ChecklistTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTask" ADD CONSTRAINT "ChecklistTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
