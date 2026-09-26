import {
  prisma,
  type AnalysisJob,
  type Device,
  type Finding,
  type HealthSnapshot,
  type MemberStatus,
  type Prisma,
  type Notification,
  type Organization,
  type OrganizationMember,
  type OrgRole,
  type PullRequest,
  type QualityGate,
  type Repository,
  type RepositoryMember,
  type RepositoryRole,
  type User,
} from '@codehealth/db';

// row builders, unique columns get fresh values

// json columns need a different type for create()
type Overrides<M, JsonKeys extends keyof M> = Partial<Omit<M, JsonKeys>> & {
  [K in JsonKeys]?: Prisma.InputJsonValue;
};

let seq = Math.floor(Math.random() * 1000000000);
const next = (): number => ++seq;

export async function createUser(overrides: Partial<User> = {}): Promise<User> {
  const n = next();
  return prisma.user.create({
    data: {
      githubId: `gh-user-${n}`,
      username: `user_${n}`,
      email: `user_${n}@example.com`,
      ...overrides,
    },
  });
}

export function createAdmin(overrides: Partial<User> = {}): Promise<User> {
  return createUser({ platformRole: 'ADMIN', ...overrides });
}

export async function createOrg(overrides: Partial<Organization> = {}): Promise<Organization> {
  const n = next();
  return prisma.organization.create({
    data: {
      githubOrgId: `gh-org-${n}`,
      login: `org-${n}`,
      name: `Org ${n}`,
      ...overrides,
    },
  });
}

export function addOrgMember(
  org: Organization,
  user: User,
  role: OrgRole = 'MEMBER',
  status: MemberStatus = 'ACTIVE',
): Promise<OrganizationMember> {
  return prisma.organizationMember.create({
    data: { orgId: org.id, userId: user.id, role, status },
  });
}

export async function createRepo(
  org: Organization,
  owner: User,
  overrides: Partial<Repository> = {},
): Promise<Repository> {
  const n = next();
  const name = overrides.name ?? `repo-${n}`;
  return prisma.repository.create({
    data: {
      githubRepoId: `gh-repo-${n}`,
      name,
      fullName: `${org.login}/${name}`,
      htmlUrl: `https://github.com/${org.login}/${name}`,
      cloneUrl: `https://github.com/${org.login}/${name}.git`,
      language: 'TypeScript',
      orgId: org.id,
      ownerId: owner.id,
      ...overrides,
    },
  });
}

export function addRepoMember(
  repo: Repository,
  user: User,
  role: RepositoryRole = 'DEVELOPER',
  status: MemberStatus = 'ACTIVE',
  addedBy?: User,
): Promise<RepositoryMember> {
  return prisma.repositoryMember.create({
    data: { repoId: repo.id, userId: user.id, role, status, addedById: addedBy?.id },
  });
}

export async function createPullRequest(
  repo: Repository,
  overrides: Partial<PullRequest> = {},
): Promise<PullRequest> {
  const n = next();
  return prisma.pullRequest.create({
    data: {
      repoId: repo.id,
      prNumber: n,
      title: `PR ${n}`,
      authorLogin: 'octocat',
      htmlUrl: `${repo.htmlUrl}/pull/${n}`,
      headBranch: `feature/${n}`,
      baseBranch: 'main',
      headSha: `sha-${n}`,
      ...overrides,
    },
  });
}

export function createAnalysisJob(
  repo: Repository,
  overrides: Partial<AnalysisJob> = {},
): Promise<AnalysisJob> {
  return prisma.analysisJob.create({
    data: {
      repoId: repo.id,
      branch: repo.defaultBranch,
      commitSha: `sha-${next()}`,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 60_000),
      completedAt: new Date(),
      ...overrides,
    },
  });
}

// creates the job too unless one is passed
export async function createSnapshot(
  repo: Repository,
  overrides: Overrides<HealthSnapshot, 'rawMetrics'> = {},
  job?: AnalysisJob,
): Promise<HealthSnapshot> {
  const analysis = job ?? (await createAnalysisJob(repo));
  return prisma.healthSnapshot.create({
    data: {
      repoId: repo.id,
      analysisId: analysis.id,
      healthScore: 82,
      debtMinutes: 120,
      totalIssues: 3,
      linesOfCode: 1000,
      gateResult: 'PASS',
      ...overrides,
    },
  });
}

export function createFinding(
  snapshot: HealthSnapshot,
  overrides: Partial<Finding> = {},
): Promise<Finding> {
  const n = next();
  return prisma.finding.create({
    data: {
      snapshotId: snapshot.id,
      repoId: snapshot.repoId,
      file: `src/file-${n}.ts`,
      line: n,
      severity: 'MEDIUM',
      category: 'CODE_SMELL',
      state: 'NEW',
      rule: `rule-${n}`,
      message: `Finding ${n}`,
      tool: 'eslint',
      debtMinutes: 5,
      ...overrides,
    },
  });
}

export function createQualityGate(
  repo: Repository,
  overrides: Partial<QualityGate> = {},
): Promise<QualityGate> {
  return prisma.qualityGate.create({
    data: { repoId: repo.id, minHealthScore: 70, blockPR: true, ...overrides },
  });
}

export function createDevice(user: User, overrides: Partial<Device> = {}): Promise<Device> {
  return prisma.device.create({
    data: {
      userId: user.id,
      expoPushToken: `ExponentPushToken[device-${next()}]`,
      platform: 'ANDROID',
      ...overrides,
    },
  });
}

export function createNotification(
  user: User,
  overrides: Overrides<Notification, 'data'> = {},
): Promise<Notification> {
  const n = next();
  return prisma.notification.create({
    data: {
      userId: user.id,
      type: 'ANALYSIS_COMPLETED',
      title: `Notification ${n}`,
      body: `Body ${n}`,
      ...overrides,
    },
  });
}
