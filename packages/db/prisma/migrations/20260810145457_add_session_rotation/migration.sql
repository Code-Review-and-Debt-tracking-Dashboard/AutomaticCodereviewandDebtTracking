/*
  Warnings:

  - Added the required column `familyId` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SessionRevokeReason" AS ENUM ('ROTATED', 'LOGOUT', 'REUSE_DETECTED', 'ADMIN_REVOKED', 'USER_INACTIVE');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "familyId" TEXT NOT NULL,
ADD COLUMN     "revokedReason" "SessionRevokeReason";

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");
