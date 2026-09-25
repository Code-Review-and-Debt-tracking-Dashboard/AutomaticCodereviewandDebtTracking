-- AlterTable
ALTER TABLE "AnalysisJob" ADD COLUMN "leasedByAgentId" TEXT,
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AnalysisJob_status_leaseExpiresAt_idx" ON "AnalysisJob"("status", "leaseExpiresAt");

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_leasedByAgentId_fkey" FOREIGN KEY ("leasedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
