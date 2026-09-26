-- AlterTable: add lease fields (leaseExpiresAt may already exist from a
-- squashed migration, so guard with IF NOT EXISTS).
ALTER TABLE "AnalysisJob" ADD COLUMN IF NOT EXISTS "leasedByAgentId" TEXT;
ALTER TABLE "AnalysisJob" ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalysisJob_status_leaseExpiresAt_idx" ON "AnalysisJob"("status", "leaseExpiresAt");

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_leasedByAgentId_fkey" FOREIGN KEY ("leasedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
