-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "RepositoryRole" AS ENUM ('TEAM_LEAD', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnalysisTrigger" AS ENUM ('WEBHOOK', 'MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('VULNERABILITY', 'COMPLEXITY', 'DUPLICATION', 'CODE_SMELL', 'MAINTAINABILITY');

-- CreateEnum
CREATE TYPE "FindingState" AS ENUM ('NEW', 'EXISTING', 'RESOLVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

-- CreateEnum
CREATE TYPE "GateResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ANALYSIS_STARTED', 'ANALYSIS_COMPLETED', 'ANALYSIS_FAILED', 'QUALITY_GATE_FAILED', 'SCORE_DROPPED', 'CRITICAL_FINDING', 'MEMBER_ADDED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubCredential" (
    "id" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "tokenType" TEXT,
    "scope" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubRepoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "cloneUrl" TEXT,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "language" TEXT,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "webhookId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryMember" (
    "id" TEXT NOT NULL,
    "role" "RepositoryRole" NOT NULL DEFAULT 'DEVELOPER',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "headBranch" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "status" "PRStatus" NOT NULL DEFAULT 'OPEN',
    "repoId" TEXT NOT NULL,
    "githubCreatedAt" TIMESTAMP(3),
    "githubUpdatedAt" TIMESTAMP(3),
    "mergedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "AnalysisTrigger" NOT NULL DEFAULT 'WEBHOOK',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "bullJobId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "repoId" TEXT NOT NULL,
    "pullRequestId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSnapshot" (
    "id" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "debtMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "debtDeltaMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vulnerabilityCount" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "complexityCount" INTEGER NOT NULL DEFAULT 0,
    "duplicationCount" INTEGER NOT NULL DEFAULT 0,
    "codeSmellCount" INTEGER NOT NULL DEFAULT 0,
    "maintainabilityCount" INTEGER NOT NULL DEFAULT 0,
    "duplicationPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "linesOfCode" INTEGER NOT NULL DEFAULT 0,
    "gateResult" "GateResult",
    "rawMetrics" JSONB,
    "analysisId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "file" TEXT,
    "line" INTEGER,
    "endLine" INTEGER,
    "column" INTEGER,
    "endColumn" INTEGER,
    "severity" "Severity" NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "state" "FindingState" NOT NULL DEFAULT 'NEW',
    "rule" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "debtMinutes" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "snapshotId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityGate" (
    "id" TEXT NOT NULL,
    "minHealthScore" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "maxCriticalFindings" INTEGER,
    "maxVulnerabilities" INTEGER,
    "maxDuplicationPct" DOUBLE PRECISION,
    "maxComplexityCount" INTEGER,
    "maxCodeSmellCount" INTEGER,
    "blockPR" BOOLEAN NOT NULL DEFAULT false,
    "repoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "repoId" TEXT,
    "snapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "deviceName" TEXT,
    "installationId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubCredential_userId_key" ON "GitHubCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubRepoId_key" ON "Repository"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_webhookId_key" ON "Repository"("webhookId");

-- CreateIndex
CREATE INDEX "Repository_ownerId_idx" ON "Repository"("ownerId");

-- CreateIndex
CREATE INDEX "Repository_fullName_idx" ON "Repository"("fullName");

-- CreateIndex
CREATE INDEX "Repository_isActive_idx" ON "Repository"("isActive");

-- CreateIndex
CREATE INDEX "Repository_ownerId_isActive_idx" ON "Repository"("ownerId", "isActive");

-- CreateIndex
CREATE INDEX "RepositoryMember_repoId_idx" ON "RepositoryMember"("repoId");

-- CreateIndex
CREATE INDEX "RepositoryMember_userId_idx" ON "RepositoryMember"("userId");

-- CreateIndex
CREATE INDEX "RepositoryMember_repoId_status_idx" ON "RepositoryMember"("repoId", "status");

-- CreateIndex
CREATE INDEX "RepositoryMember_addedById_idx" ON "RepositoryMember"("addedById");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryMember_userId_repoId_key" ON "RepositoryMember"("userId", "repoId");

-- CreateIndex
CREATE INDEX "PullRequest_repoId_idx" ON "PullRequest"("repoId");

-- CreateIndex
CREATE INDEX "PullRequest_status_idx" ON "PullRequest"("status");

-- CreateIndex
CREATE INDEX "PullRequest_repoId_status_idx" ON "PullRequest"("repoId", "status");

-- CreateIndex
CREATE INDEX "PullRequest_repoId_updatedAt_idx" ON "PullRequest"("repoId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_repoId_prNumber_key" ON "PullRequest"("repoId", "prNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisJob_bullJobId_key" ON "AnalysisJob"("bullJobId");

-- CreateIndex
CREATE INDEX "AnalysisJob_repoId_idx" ON "AnalysisJob"("repoId");

-- CreateIndex
CREATE INDEX "AnalysisJob_status_idx" ON "AnalysisJob"("status");

-- CreateIndex
CREATE INDEX "AnalysisJob_repoId_status_idx" ON "AnalysisJob"("repoId", "status");

-- CreateIndex
CREATE INDEX "AnalysisJob_status_queuedAt_idx" ON "AnalysisJob"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_pullRequestId_idx" ON "AnalysisJob"("pullRequestId");

-- CreateIndex
CREATE INDEX "AnalysisJob_repoId_queuedAt_idx" ON "AnalysisJob"("repoId", "queuedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "HealthSnapshot_analysisId_key" ON "HealthSnapshot"("analysisId");

-- CreateIndex
CREATE INDEX "HealthSnapshot_repoId_idx" ON "HealthSnapshot"("repoId");

-- CreateIndex
CREATE INDEX "HealthSnapshot_repoId_calculatedAt_idx" ON "HealthSnapshot"("repoId", "calculatedAt" DESC);

-- CreateIndex
CREATE INDEX "HealthSnapshot_gateResult_idx" ON "HealthSnapshot"("gateResult");

-- CreateIndex
CREATE INDEX "HealthSnapshot_calculatedAt_idx" ON "HealthSnapshot"("calculatedAt" DESC);

-- CreateIndex
CREATE INDEX "Finding_snapshotId_idx" ON "Finding"("snapshotId");

-- CreateIndex
CREATE INDEX "Finding_snapshotId_category_idx" ON "Finding"("snapshotId", "category");

-- CreateIndex
CREATE INDEX "Finding_snapshotId_severity_idx" ON "Finding"("snapshotId", "severity");

-- CreateIndex
CREATE INDEX "Finding_snapshotId_state_idx" ON "Finding"("snapshotId", "state");

-- CreateIndex
CREATE INDEX "Finding_snapshotId_file_idx" ON "Finding"("snapshotId", "file");

-- CreateIndex
CREATE INDEX "Finding_repoId_severity_idx" ON "Finding"("repoId", "severity");

-- CreateIndex
CREATE INDEX "Finding_repoId_state_idx" ON "Finding"("repoId", "state");

-- CreateIndex
CREATE INDEX "Finding_severity_idx" ON "Finding"("severity");

-- CreateIndex
CREATE INDEX "Finding_category_idx" ON "Finding"("category");

-- CreateIndex
CREATE UNIQUE INDEX "QualityGate_repoId_key" ON "QualityGate"("repoId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_repoId_idx" ON "Notification"("repoId");

-- CreateIndex
CREATE INDEX "Notification_snapshotId_idx" ON "Notification"("snapshotId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Device_expoPushToken_key" ON "Device"("expoPushToken");

-- CreateIndex
CREATE UNIQUE INDEX "Device_installationId_key" ON "Device"("installationId");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE INDEX "Device_userId_active_idx" ON "Device"("userId", "active");

-- AddForeignKey
ALTER TABLE "GitHubCredential" ADD CONSTRAINT "GitHubCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryMember" ADD CONSTRAINT "RepositoryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryMember" ADD CONSTRAINT "RepositoryMember_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryMember" ADD CONSTRAINT "RepositoryMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSnapshot" ADD CONSTRAINT "HealthSnapshot_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSnapshot" ADD CONSTRAINT "HealthSnapshot_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "HealthSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityGate" ADD CONSTRAINT "QualityGate_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "HealthSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
