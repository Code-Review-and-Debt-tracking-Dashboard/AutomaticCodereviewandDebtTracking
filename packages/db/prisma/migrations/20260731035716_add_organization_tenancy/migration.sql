-- Introduces the organization (tenant) boundary.
--
-- Repository."orgId" is NOT NULL, which cannot be added directly to a table
-- that already has rows. This migration therefore runs in three phases:
-- create the new tables, add the column as nullable and backfill it, then
-- tighten it to NOT NULL. The backfill statements are hand-written because
-- Prisma cannot infer how existing data maps onto a new tenant.

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('USER', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "githubOrgId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "type" "OrgType" NOT NULL DEFAULT 'ORGANIZATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_githubOrgId_key" ON "Organization"("githubOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_login_key" ON "Organization"("login");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_status_idx" ON "OrganizationMember"("userId", "status");

-- CreateIndex
CREATE INDEX "OrganizationMember_orgId_status_idx" ON "OrganizationMember"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_orgId_userId_key" ON "OrganizationMember"("orgId", "userId");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: nullable for now so that existing rows survive the backfill below.
ALTER TABLE "Repository" ADD COLUMN "orgId" TEXT;

-- Backfill step 1: every existing repository was linked by a user, so that
-- user's own GitHub account becomes the tenant that owns it. This matches how
-- the app models a personal account from here on.
INSERT INTO "Organization" ("id", "githubOrgId", "login", "name", "avatarUrl", "type", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."githubId", u."username", u."username", u."avatarUrl", 'USER', NOW(), NOW()
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Repository" r WHERE r."ownerId" = u."id")
ON CONFLICT ("githubOrgId") DO NOTHING;

-- Backfill step 2: each of those users owns their personal organization.
INSERT INTO "OrganizationMember" ("id", "role", "status", "orgId", "userId", "syncedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'OWNER', 'ACTIVE', o."id", u."id", NOW(), NOW(), NOW()
FROM "User" u
JOIN "Organization" o ON o."githubOrgId" = u."githubId"
ON CONFLICT ("orgId", "userId") DO NOTHING;

-- Backfill step 3: point each repository at its owner's organization.
UPDATE "Repository" r
SET "orgId" = o."id"
FROM "User" u
JOIN "Organization" o ON o."githubOrgId" = u."githubId"
WHERE r."ownerId" = u."id" AND r."orgId" IS NULL;

-- Backfill step 4: anyone who is already an active member of a repository has
-- to join that repository's tenant too, otherwise the new boundary would
-- silently revoke access they have today.
INSERT INTO "OrganizationMember" ("id", "role", "status", "orgId", "userId", "syncedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'MEMBER', 'ACTIVE', t."orgId", t."userId", NOW(), NOW(), NOW()
FROM (
    SELECT DISTINCT r."orgId", m."userId"
    FROM "RepositoryMember" m
    JOIN "Repository" r ON r."id" = m."repoId"
    WHERE m."status" = 'ACTIVE' AND r."orgId" IS NOT NULL
) t
ON CONFLICT ("orgId", "userId") DO NOTHING;

-- AlterTable: every row now has a tenant, so the column can be tightened.
ALTER TABLE "Repository" ALTER COLUMN "orgId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Repository_orgId_isActive_idx" ON "Repository"("orgId", "isActive");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
