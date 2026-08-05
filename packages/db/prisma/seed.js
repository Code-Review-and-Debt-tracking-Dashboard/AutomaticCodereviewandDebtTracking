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

  const demoUser = await prisma.user.upsert({
    where: { githubId: "seed-github-demo" },
    update: {
      id: "usr-demo-001",
      username: "demo_developer",
      email: "demo@codehealth.dev",
      platformRole: PlatformRole.ADMIN,
      active: true,
    },
    create: {
      id: "usr-demo-001",
      githubId: "seed-github-demo",
      username: "demo_developer",
      email: "demo@codehealth.dev",
      platformRole: PlatformRole.ADMIN,
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
    [acme.id, demoUser.id, OrgRole.OWNER],
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

  await prisma.repositoryMember.upsert({
    where: {
      userId_repoId: {
        userId: demoUser.id,
        repoId: repository.id,
      },
    },
    update: {
      role: RepositoryRole.TEAM_LEAD,
      status: MemberStatus.ACTIVE,
      addedById: admin.id,
      removedAt: null,
    },
    create: {
      userId: demoUser.id,
      repoId: repository.id,
      role: RepositoryRole.TEAM_LEAD,
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

  // Seed ~30 days of HealthSnapshot history (Task C-04b)
  const now = new Date("2026-08-03T12:00:00.000Z");
  let latestSnapshot = null;

  for (let i = 30; i >= 0; i--) {
    const calcDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const bullJobId = i === 0 ? "seed-analysis-job-1001" : `seed-analysis-job-hist-${i}`;
    
    // Gradual health improvement: score 65 -> 88
    const healthScore = Math.min(88, Math.max(60, Math.round(65 + (30 - i) * 0.75 + (i % 3))));
    const debtMinutes = Math.max(80, Math.round(240 - (30 - i) * 4.8));
    const debtDeltaMinutes = i === 30 ? 0 : -5;
    const vuln = Math.max(0, 3 - Math.floor((30 - i) / 10));
    const complexity = Math.max(1, 6 - Math.floor((30 - i) / 6));
    const codeSmells = Math.max(1, 8 - Math.floor((30 - i) / 4));

    const histJob = await prisma.analysisJob.upsert({
      where: { bullJobId },
      update: {
        status: AnalysisStatus.COMPLETED,
        trigger: i % 2 === 0 ? AnalysisTrigger.WEBHOOK : AnalysisTrigger.MANUAL,
        progress: 100,
        branch: "main",
        commitSha: `sha-${1000 + i}`,
        repoId: repository.id,
        pullRequestId: i === 0 ? pullRequest.id : null,
        completedAt: calcDate,
      },
      create: {
        bullJobId,
        status: AnalysisStatus.COMPLETED,
        trigger: i % 2 === 0 ? AnalysisTrigger.WEBHOOK : AnalysisTrigger.MANUAL,
        progress: 100,
        branch: "main",
        commitSha: `sha-${1000 + i}`,
        repoId: repository.id,
        pullRequestId: i === 0 ? pullRequest.id : null,
        startedAt: new Date(calcDate.getTime() - 4 * 60 * 1000),
        completedAt: calcDate,
      },
    });

    const histSnap = await prisma.healthSnapshot.upsert({
      where: { analysisId: histJob.id },
      update: {
        repoId: repository.id,
        healthScore,
        debtMinutes,
        debtDeltaMinutes,
        vulnerabilityCount: vuln,
        highCount: vuln,
        mediumCount: complexity,
        lowCount: codeSmells,
        complexityCount: complexity,
        duplicationCount: 1,
        codeSmellCount: codeSmells,
        maintainabilityCount: 0,
        duplicationPct: Number((4.5 - (30 - i) * 0.05).toFixed(1)),
        totalIssues: vuln + complexity + codeSmells,
        linesOfCode: 2450 + (30 - i) * 15,
        gateResult: healthScore >= 70 ? GateResult.PASS : GateResult.FAIL,
        calculatedAt: calcDate,
        rawMetrics: { source: "seed", day: i },
      },
      create: {
        analysisId: histJob.id,
        repoId: repository.id,
        healthScore,
        debtMinutes,
        debtDeltaMinutes,
        vulnerabilityCount: vuln,
        highCount: vuln,
        mediumCount: complexity,
        lowCount: codeSmells,
        complexityCount: complexity,
        duplicationCount: 1,
        codeSmellCount: codeSmells,
        maintainabilityCount: 0,
        duplicationPct: Number((4.5 - (30 - i) * 0.05).toFixed(1)),
        totalIssues: vuln + complexity + codeSmells,
        linesOfCode: 2450 + (30 - i) * 15,
        gateResult: healthScore >= 70 ? GateResult.PASS : GateResult.FAIL,
        calculatedAt: calcDate,
        rawMetrics: { source: "seed", day: i },
      },
    });

    if (i === 0) {
      latestSnapshot = histSnap;
    }
  }

  const snapshot = latestSnapshot;

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
      data: { analysisId: snapshot.analysisId, healthScore: 78 },
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
        where: { repoId: repository.id },
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