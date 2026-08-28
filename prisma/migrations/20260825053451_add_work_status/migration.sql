-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING_PENDING', 'BLOCKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WorkPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VA';

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "matterReference" TEXT,
    "clientReference" TEXT,
    "status" "WorkStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "WorkPriority" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "blockedReason" TEXT,
    "blockedNeeds" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedCompletion" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkActivity" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousStatus" "WorkStatus",
    "newStatus" "WorkStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAdminNote" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkItem_userId_status_idx" ON "WorkItem"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkItem_userId_deletedAt_idx" ON "WorkItem"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "WorkItem_status_deletedAt_idx" ON "WorkItem"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "WorkItem_completedAt_idx" ON "WorkItem"("completedAt");

-- CreateIndex
CREATE INDEX "WorkActivity_workItemId_createdAt_idx" ON "WorkActivity"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkAdminNote_workItemId_createdAt_idx" ON "WorkAdminNote"("workItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkActivity" ADD CONSTRAINT "WorkActivity_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkActivity" ADD CONSTRAINT "WorkActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAdminNote" ADD CONSTRAINT "WorkAdminNote_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAdminNote" ADD CONSTRAINT "WorkAdminNote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
