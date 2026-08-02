require("dotenv/config");

const { PrismaPg } = require("@prisma/adapter-pg");
const {
  AnalysisStatus,
  AnalysisTrigger,
  DevicePlatform,
  FindingCategory,
  FindingState,
  GateResult,
  MemberStatus,
  NotificationType,
  OrgRole,
  OrgType,
  PlatformRole,
  PrismaClient,
  PRStatus,
  RepositoryRole,
  Severity,
} = require("@prisma/client");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and add your PostgreSQL connection string.",
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.upsert({
    where: { githubId: "seed-github-admin" },
    update: {
      username: "seed-admin",
      email: "admin@example.com",
      platformRole: PlatformRole.ADMIN,
      active: true,
    },
    create: {
      githubId: "seed-github-admin",
      username: "seed-admin",
      email: "admin@example.com",
      platformRole: PlatformRole.ADMIN,
    },
  });

  const developer = await prisma.user.upsert({
    where: { githubId: "seed-github-developer" },
    update: {
      username: "seed-developer",
      email: "developer@example.com",
      active: true,
    },
    create: {
      githubId: "seed-github-developer",
      username: "seed-developer",
      email: "developer@example.com",
    },
  });

  // Two tenants are seeded on purpose. The second one exists so that cross-org
  // isolation can actually be demonstrated: its user must not be able to reach
  // anything belonging to the first.
  const acme = await prisma.organization.upsert({
    where: { githubOrgId: "seed-github-org-2001" },
    update: {
      login: "seed-acme",
      name: "Seed Acme Corp",
      type: OrgType.ORGANIZATION,
    },
    create: {
      githubOrgId: "seed-github-org-2001",
      login: "seed-acme",
      name: "Seed Acme Corp",
      type: OrgType.ORGANIZATION,
    },
  });

  const globex = await prisma.organization.upsert({
    where: { githubOrgId: "seed-github-org-2002" },
    update: {
      login: "seed-globex",
      name: "Seed Globex Ltd",
      type: OrgType.ORGANIZATION,
    },
    create: {
      githubOrgId: "seed-github-org-2002",
      login: "seed-globex",
      name: "Seed Globex Ltd",
      type: OrgType.ORGANIZATION,
    },
  });

  const outsider = await prisma.user.upsert({
    where: { githubId: "seed-github-outsider" },
    update: {
      username: "seed-outsider",
      email: "outsider@example.com",
      active: true,
    },
    create: {
      githubId: "seed-github-outsider",
      username: "seed-outsider",
      email: "outsider@example.com",
    },
  });

  for (const [orgId, userId, role] of [
    [acme.id, admin.id, OrgRole.OWNER],
    [acme.id, developer.id, OrgRole.MEMBER],
    [globex.id, outsider.id, OrgRole.OWNER],
  ]) {
    await prisma.organizationMember.upsert({
      where: { orgId_userId: { orgId, userId } },
      update: { role, status: MemberStatus.ACTIVE, syncedAt: new Date() },
      create: { orgId, userId, role, status: MemberStatus.ACTIVE },
    });
  }

  const repository = await prisma.repository.upsert({
    where: { githubRepoId: "seed-repository-1001" },
    update: {
      name: "code-health-demo",
      fullName: "seed-acme/code-health-demo",
      htmlUrl: "https://github.com/seed-acme/code-health-demo",
      cloneUrl: "https://github.com/seed-acme/code-health-demo.git",
      defaultBranch: "main",
      language: "TypeScript",
      private: false,
      isActive: true,
      orgId: acme.id,
      ownerId: admin.id,
    },
    create: {
      githubRepoId: "seed-repository-1001",
      name: "code-health-demo",
      fullName: "seed-acme/code-health-demo",
      htmlUrl: "https://github.com/seed-acme/code-health-demo",
      cloneUrl: "https://github.com/seed-acme/code-health-demo.git",
      defaultBranch: "main",
      language: "TypeScript",
      orgId: acme.id,
      ownerId: admin.id,
    },
  });

  // Belongs to the other tenant. Nothing else in this seed references it.
  await prisma.repository.upsert({
    where: { githubRepoId: "seed-repository-2001" },
    update: {
      name: "other-tenant-demo",
      fullName: "seed-globex/other-tenant-demo",
      htmlUrl: "https://github.com/seed-globex/other-tenant-demo",
      cloneUrl: "https://github.com/seed-globex/other-tenant-demo.git",
      defaultBranch: "main",
      language: "Python",
      private: false,
      isActive: true,
      orgId: globex.id,
      ownerId: outsider.id,
    },
    create: {
      githubRepoId: "seed-repository-2001",
      name: "other-tenant-demo",
      fullName: "seed-globex/other-tenant-demo",
      htmlUrl: "https://github.com/seed-globex/other-tenant-demo",
      cloneUrl: "https://github.com/seed-globex/other-tenant-demo.git",
      defaultBranch: "main",
      language: "Python",
      orgId: globex.id,
      ownerId: outsider.id,
    },
  });

  await prisma.repositoryMember.upsert({
    where: {
      userId_repoId: {
        userId: developer.id,
        repoId: repository.id,
      },
    },
    update: {
      role: RepositoryRole.DEVELOPER,
      status: MemberStatus.ACTIVE,
      addedById: admin.id,
      removedAt: null,
    },
    create: {
      userId: developer.id,
      repoId: repository.id,
      role: RepositoryRole.DEVELOPER,
      status: MemberStatus.ACTIVE,
      addedById: admin.id,
    },
  });

  const pullRequest = await prisma.pullRequest.upsert({
    where: {
      repoId_prNumber: {
        repoId: repository.id,
        prNumber: 42,
      },
    },
    update: {
      title: "Improve repository health dashboard",
      authorLogin: developer.username,
      htmlUrl: `${repository.htmlUrl}/pull/42`,
      headBranch: "feature/health-dashboard",
      baseBranch: "main",
      headSha: "seed1234567890abcdef",
      status: PRStatus.OPEN,
    },
    create: {
      repoId: repository.id,
      prNumber: 42,
      title: "Improve repository health dashboard",
      authorLogin: developer.username,
      htmlUrl: `${repository.htmlUrl}/pull/42`,
      headBranch: "feature/health-dashboard",
      baseBranch: "main",
      headSha: "seed1234567890abcdef",
      status: PRStatus.OPEN,
      githubCreatedAt: new Date("2026-07-19T05:00:00.000Z"),
      githubUpdatedAt: new Date("2026-07-19T05:30:00.000Z"),
    },
  });

  const analysis = await prisma.analysisJob.upsert({
    where: { bullJobId: "seed-analysis-job-1001" },
    update: {
      status: AnalysisStatus.COMPLETED,
      trigger: AnalysisTrigger.MANUAL,
      progress: 100,
      branch: pullRequest.headBranch,
      commitSha: pullRequest.headSha,
      repoId: repository.id,
      pullRequestId: pullRequest.id,
      errorMessage: null,
      completedAt: new Date("2026-07-19T05:35:00.000Z"),
    },
    create: {
      bullJobId: "seed-analysis-job-1001",
      status: AnalysisStatus.COMPLETED,
      trigger: AnalysisTrigger.MANUAL,
      progress: 100,
      branch: pullRequest.headBranch,
      commitSha: pullRequest.headSha,
      repoId: repository.id,
      pullRequestId: pullRequest.id,
      startedAt: new Date("2026-07-19T05:31:00.000Z"),
      completedAt: new Date("2026-07-19T05:35:00.000Z"),
    },
  });

  const snapshot = await prisma.healthSnapshot.upsert({
    where: { analysisId: analysis.id },
    update: {
      repoId: repository.id,
      healthScore: 78,
      debtMinutes: 95,
      debtDeltaMinutes: -15,
      vulnerabilityCount: 1,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 1,
      lowCount: 0,
      complexityCount: 1,
      duplicationCount: 1,
      codeSmellCount: 1,
      maintainabilityCount: 0,
      duplicationPct: 4.2,
      totalIssues: 3,
      linesOfCode: 2450,
      gateResult: GateResult.PASS,
      rawMetrics: { source: "seed", analysisVersion: "1.0" },
    },
    create: {
      analysisId: analysis.id,
      repoId: repository.id,
      healthScore: 78,
      debtMinutes: 95,
      debtDeltaMinutes: -15,
      vulnerabilityCount: 1,
      highCount: 1,
      mediumCount: 1,
      complexityCount: 1,
      duplicationCount: 1,
      codeSmellCount: 1,
      duplicationPct: 4.2,
      totalIssues: 3,
      linesOfCode: 2450,
      gateResult: GateResult.PASS,
      rawMetrics: { source: "seed", analysisVersion: "1.0" },
    },
  });

  await prisma.finding.deleteMany({
    where: {
      snapshotId: snapshot.id,
      tool: "seed-analyzer",
    },
  });

  await prisma.finding.createMany({
    data: [
      {
        snapshotId: snapshot.id,
        repoId: repository.id,
        file: "src/auth/token.ts",
        line: 28,
        severity: Severity.HIGH,
        category: FindingCategory.VULNERABILITY,
        state: FindingState.NEW,
        rule: "security/no-plain-token",
        message: "Store authentication tokens securely.",
        tool: "seed-analyzer",
        debtMinutes: 45,
      },
      {
        snapshotId: snapshot.id,
        repoId: repository.id,
        file: "src/services/analysis.ts",
        line: 64,
        severity: Severity.MEDIUM,
        category: FindingCategory.COMPLEXITY,
        state: FindingState.EXISTING,
        rule: "complexity/function",
        message: "Reduce this function's cognitive complexity.",
        tool: "seed-analyzer",
        debtMinutes: 30,
      },
      {
        snapshotId: snapshot.id,
        repoId: repository.id,
        file: "src/utils/format.ts",
        line: 12,
        severity: Severity.LOW,
        category: FindingCategory.CODE_SMELL,
        state: FindingState.NEW,
        rule: "style/duplicate-formatting",
        message: "Extract the repeated formatting logic.",
        tool: "seed-analyzer",
        debtMinutes: 20,
      },
    ],
  });

  await prisma.qualityGate.upsert({
    where: { repoId: repository.id },
    update: {
      minHealthScore: 70,
      maxCriticalFindings: 0,
      maxVulnerabilities: 2,
      maxDuplicationPct: 10,
      blockPR: true,
    },
    create: {
      repoId: repository.id,
      minHealthScore: 70,
      maxCriticalFindings: 0,
      maxVulnerabilities: 2,
      maxDuplicationPct: 10,
      blockPR: true,
    },
  });

  // Seed 30 days of HealthSnapshot history for trend charts (C-04b)
  const now = new Date();
  for (let i = 30; i >= 1; i--) {
    const calcDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayJobId = `seed-analysis-history-${i}`;

    const dayJob = await prisma.analysisJob.upsert({
      where: { id: dayJobId },
      update: {
        status: AnalysisStatus.COMPLETED,
        trigger: AnalysisTrigger.SCHEDULED,
        completedAt: calcDate,
      },
      create: {
        id: dayJobId,
        repoId: repository.id,
        status: AnalysisStatus.COMPLETED,
        trigger: AnalysisTrigger.SCHEDULED,
        branch: "main",
        commitSha: `sha-history-${i}`,
        completedAt: calcDate,
      },
    });

    const baseScore = 75 + Math.sin(i / 3) * 10;
    const debt = Math.round(180 + Math.cos(i / 2) * 40);

    await prisma.healthSnapshot.upsert({
      where: { analysisId: dayJob.id },
      update: {
        healthScore: Number(baseScore.toFixed(1)),
        debtMinutes: debt,
        calculatedAt: calcDate,
      },
      create: {
        analysisId: dayJob.id,
        repoId: repository.id,
        healthScore: Number(baseScore.toFixed(1)),
        debtMinutes: debt,
        debtDeltaMinutes: -2,
        vulnerabilityCount: Math.max(0, Math.floor(5 - i / 10)),
        criticalCount: 1,
        highCount: 2,
        mediumCount: 4,
        lowCount: 5,
        totalIssues: 12,
        gateResult: baseScore >= 70 ? GateResult.PASS : GateResult.FAIL,
        calculatedAt: calcDate,
      },
    });
  }


  await prisma.notification.deleteMany({
    where: {
      userId: developer.id,
      repoId: repository.id,
      title: "Seed analysis completed",
    },
  });

  await prisma.notification.create({
    data: {
      type: NotificationType.ANALYSIS_COMPLETED,
      title: "Seed analysis completed",
      body: "The demo repository scored 78 and passed its quality gate.",
      data: { analysisId: analysis.id, healthScore: 78 },
      userId: developer.id,
      repoId: repository.id,
      snapshotId: snapshot.id,
    },
  });

  await prisma.device.upsert({
    where: { installationId: "seed-device-installation-1001" },
    update: {
      userId: developer.id,
      expoPushToken: "ExponentPushToken[seed-device-not-for-production]",
      platform: DevicePlatform.ANDROID,
      deviceName: "Seed Android Device",
      active: true,
    },
    create: {
      userId: developer.id,
      expoPushToken: "ExponentPushToken[seed-device-not-for-production]",
      installationId: "seed-device-installation-1001",
      platform: DevicePlatform.ANDROID,
      deviceName: "Seed Android Device",
    },
  });

  const [orgCount, userCount, repositoryCount, snapshotCount, findingCount, notificationCount] =
    await Promise.all([
      prisma.organization.count({
        where: {
          githubOrgId: { in: ["seed-github-org-2001", "seed-github-org-2002"] },
        },
      }),
      prisma.user.count({
        where: {
          githubId: {
            in: ["seed-github-admin", "seed-github-developer", "seed-github-outsider"],
          },
        },
      }),
      prisma.repository.count({
        where: {
          githubRepoId: { in: ["seed-repository-1001", "seed-repository-2001"] },
        },
      }),
      prisma.healthSnapshot.count({
        where: { analysisId: analysis.id },
      }),
      prisma.finding.count({
        where: {
          snapshotId: snapshot.id,
          tool: "seed-analyzer",
        },
      }),
      prisma.notification.count({
        where: {
          userId: developer.id,
          repoId: repository.id,
          title: "Seed analysis completed",
        },
      }),
    ]);

  console.log(
    `Seed completed: ${orgCount} organizations, ${userCount} users, ${repositoryCount} repositories, ${snapshotCount} snapshot, ${findingCount} findings, and ${notificationCount} notification.`,
  );
}

main()
  .catch((error) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
