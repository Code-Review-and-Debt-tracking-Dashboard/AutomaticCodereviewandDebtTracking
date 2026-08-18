import { prisma} from '@codehealth/db';

import { AppError} from '../middleware/errorHandler';

async function getActiveRepo(repoId: string){
    const repo = await prisma.repository.findUnique({where: {id: repoId}});
    if (!repo || !repo.isActive){
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
    }
    return repo;
}

interface TrendQuery{
    days?: unknown;
    from?: unknown;
    to?: unknown;

}

function resolveTrendRange(query: TrendQuery): {from: Date; to: Date}{
    const fromRaw = typeof query.from === 'string' ? query.from : undefined;
    const toRaw = typeof query.to === 'string' ? query.to : undefined;

    if (fromRaw || toRaw){
        if (!fromRaw || !toRaw){
            throw new AppError(400, 'VALIDATION_ERROR', '"from" and "to" must be provided together');
        }

        const from = new Date(fromRaw);
        const to = new Date(toRaw);

        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())){
            throw new AppError(400, 'VALIDATION_ERROR', '"from" and "to" must be valid dates');
        }

        if (from > to){
            throw new AppError(400, 'VALIDATION_ERROR', '"from" must not be after "to"');
        }

        return {from, to};

    }

    const daysRaw = typeof query.days === 'string' ? query.days : undefined;
    const days = daysRaw === undefined ? 30 : Number(daysRaw);

    if (!Number.isInteger(days) || days <=0 || days > 365){
        throw new AppError(400, 'VALIDATION_ERROR', '"days" must be an integer between 1 and 365');
    }

    const to = new Date();
    const from =  new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    return { from, to };

}

export async function getRepoTrend(repoId: string, query: TrendQuery){
   
    await getActiveRepo(repoId);
    const { from, to } = resolveTrendRange(query);
    const snapshots = await prisma.healthSnapshot.findMany({
        where: {
            repoId,
            calculatedAt: { gte: from, lte: to },
        },

        orderBy: { calculatedAt: 'asc'},
        select: {
            id: true,
            calculatedAt: true,
            healthScore: true,
            debtMinutes: true,
            totalIssues: true,
            vulnerabilityCount: true,
            complexityCount: true,
            duplicationPct: true,

        },
        
    });

    return {
        repoId,
        range: { from: from.toISOString(), to: to.toISOString() },
        dataPoints: snapshots.map((s) => ({
            date: s.calculatedAt.toISOString(),
            healthScore: s.healthScore,
            debtMinutes: s.debtMinutes,
            totalIssues: s.totalIssues,
            vulnerabilityCount: s.vulnerabilityCount,
            complexityCount: s.complexityCount,
            duplicationPct: s.duplicationPct,
            snapshotId: s.id,
        })),
    };

}

export async function getRepoDebt(repoId: string){
    await getActiveRepo(repoId);
    
    //findFirst()-Returns the first snapshot after sorting.
    const snapshot =await prisma.healthSnapshot.findFirst({
        where: { repoId },
        orderBy: { calculatedAt: 'desc' },
    });

    if (!snapshot) {
        throw new AppError(404, 'NOT_FOUND', 'No analysis found for this repository');
    }

    const grouped = await prisma.finding.groupBy({
        by: ['category' ],
        where: {snapshotId: snapshot.id },
        _sum: { debtMinutes: true },
        _count: true,
    });
    
    //maps prisma enum values to the lowercase JSON keys used in the API response
    const CATEGORY_KEYS: Record<string, string> = {
        VULNERABILITY: 'vulnerability',
        COMPLEXITY: 'complexity',
        DUPLICATION: 'duplication',
        CODE_SMELL: 'code_smell',
        MAINTAINABILITY: 'maintainability',
    };

    const breakdown: Record<string, { count: number; debtMinutes: number }>={};
    for (const key of Object.values(CATEGORY_KEYS)) {
        breakdown[key] = { count: 0, debtMinutes: 0 };
    }
    //Replace default values with database results
    for (const g of grouped) {
        const key = CATEGORY_KEYS[g.category];
        breakdown[key] = {
            count: g._count,
            //use 0 ,uless this is null or undefined, which can happen if there are no findings in this category
            debtMinutes: g._sum.debtMinutes ?? 0,
        };
    }

    return {
        totalDebtMinutes: snapshot.debtMinutes,
        debtDelta: snapshot.debtDeltaMinutes,
        breakdown,
        snapshotId: snapshot.id,
    };
}

interface HotspotQuery {
    limit?: unknown;
    snapshotId?: unknown;
}

const SEVERITY_KEYS: Record<string, string> = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    INFO: 'info',
};

function resolveHotspotLimit(query: HotspotQuery): number {
    const limitRaw = typeof query.limit === 'string' ? query.limit : undefined;
    const limit = limitRaw === undefined ? 10 : Number(limitRaw);

    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
        throw new AppError(400, 'VALIDATION_ERROR', '"limit" must be an integer between 1 and 100');
    }

    return limit;
}

export async function getRepoHotspots(repoId: string, query: HotspotQuery) {
    await getActiveRepo(repoId);

    const limit = resolveHotspotLimit(query);
    const snapshotId = typeof query.snapshotId === 'string' ? query.snapshotId : undefined;

    const snapshot = snapshotId
        ? await prisma.healthSnapshot.findFirst({ where: { id: snapshotId, repoId } })
        : await prisma.healthSnapshot.findFirst({ where: { repoId }, orderBy: { calculatedAt: 'desc' } });

    if (!snapshot) {
        throw new AppError(404, 'NOT_FOUND', 'No analysis found for this repository');
    }

    const ranked = await prisma.finding.groupBy({
        by: ['file'],
        where: { snapshotId: snapshot.id, file: { not: null } },
        _count: true,
        _sum: { debtMinutes: true },
        orderBy: { _count: { file: 'desc' } },
        take: limit,
    });

    const topFiles = ranked.map((r) => r.file as string);

    const breakdown = await prisma.finding.groupBy({
        by: ['file', 'severity', 'state'],
        where: { snapshotId: snapshot.id, file: { in: topFiles } },
        _count: true,
    });

    const bySeverityByFile = new Map<string, Record<string, number>>();
    const newFindingsByFile = new Map<string, number>();

    for (const file of topFiles) {
        const zeroed: Record<string, number> = {};
        for (const key of Object.values(SEVERITY_KEYS)) {
            zeroed[key] = 0;
        }
        bySeverityByFile.set(file, zeroed);
        newFindingsByFile.set(file, 0);
    }

    for (const row of breakdown) {
        const file = row.file as string;
        const severityKey = SEVERITY_KEYS[row.severity];
        const bySeverity = bySeverityByFile.get(file)!;
        bySeverity[severityKey] += row._count;

        if (row.state === 'NEW') {
            newFindingsByFile.set(file, (newFindingsByFile.get(file) ?? 0) + row._count);
        }
    }

    return {
        snapshotId: snapshot.id,
        files: ranked.map((r) => ({
            file: r.file as string,
            totalFindings: r._count,
            newFindings: newFindingsByFile.get(r.file as string) ?? 0,
            bySeverity: bySeverityByFile.get(r.file as string)!,
            debtMinutes: r._sum.debtMinutes ?? 0,
        })),
    };
}

export async function getRepoDetail(repoId: string) {
    const repo = await getActiveRepo(repoId);
    
    const latestSnapshot = await prisma.healthSnapshot.findFirst({
        where: { repoId },
        orderBy: { calculatedAt: 'desc' },
    });

    return {
        id: repo.id,
        githubRepoId: repo.githubRepoId,
        name: repo.name,
        fullName: repo.fullName,
        htmlUrl: repo.htmlUrl,
        cloneUrl: repo.cloneUrl,
        defaultBranch: repo.defaultBranch,
        language: repo.language,
        private: repo.private,
        orgId: repo.orgId,
        ownerId: repo.ownerId,
        healthScore: latestSnapshot?.healthScore ?? 80,
        openFindings: latestSnapshot?.totalIssues ?? 0,
        debtMinutes: latestSnapshot?.debtMinutes ?? 0,
        lastAnalyzedAt: latestSnapshot?.calculatedAt ? latestSnapshot.calculatedAt.toISOString() : null,
        createdAt: repo.createdAt.toISOString(),
        updatedAt: repo.updatedAt.toISOString(),
    };
}

export async function getRepoPullRequests(repoId: string) {
    await getActiveRepo(repoId);

    const pullRequests = await prisma.pullRequest.findMany({
        where: { repoId },
        include: {
            analysisJobs: {
                orderBy: { completedAt: 'desc' },
                take: 1,
                include: {
                    snapshot: true,
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    return pullRequests.map((pr) => {
        const latestJob = pr.analysisJobs[0];
        const snapshot = latestJob?.snapshot;

        return {
            id: pr.prNumber,
            title: pr.title,
            author: pr.authorLogin,
            branch: pr.headBranch,
            score: snapshot?.healthScore ?? 85,
            findings: snapshot?.totalIssues ?? 0,
            debtDelta: snapshot?.debtDeltaMinutes ?? 0,
            status: snapshot ? (snapshot.gateResult === 'PASS' ? 'Passed' : 'Needs attention') : 'Pending',
            time: pr.githubUpdatedAt ? pr.githubUpdatedAt.toISOString() : pr.updatedAt.toISOString(),
            htmlUrl: pr.htmlUrl,
        };
    });
}

export async function getRepoPullRequestDetail(repoId: string, prNumber: number) {
  await getActiveRepo(repoId);
  const pr = await prisma.pullRequest.findUnique({
    where: { repoId_prNumber: { repoId, prNumber } },
    include: {
      analysisJobs: {
        orderBy: { completedAt: 'desc' },
        include: { snapshot: true },
      },
    },
  });

  if (!pr) {
    throw new AppError(404, 'NOT_FOUND', 'Pull request not found');
  }

  const snapshots = await Promise.all(
    pr.analysisJobs
      .filter((job) => job.snapshot !== null)
      .map(async (job) => {
        const snapshot = job.snapshot!;
        const newIssues = await prisma.finding.count({
          where: { snapshotId: snapshot.id, state: 'NEW' },
        });

        return {
          id: snapshot.id,
          healthScore: snapshot.healthScore,
          debtMinutes: snapshot.debtMinutes,
          totalIssues: snapshot.totalIssues,
          newIssues,
          status: job.status,
          gateResult: snapshot.gateResult,
          createdAt: snapshot.calculatedAt.toISOString(),
        };
      }),
  );

  return {
    id: pr.id,
    prNumber: pr.prNumber,
    title: pr.title,
    authorLogin: pr.authorLogin,
    headBranch: pr.headBranch,
    baseBranch: pr.baseBranch,
    status: pr.status,
    snapshots,
  };
}

export async function getAvailableRepos(userId: string, orgId?: string) {
    // Return mock available repos or user org repos for linking
    const existing = await prisma.repository.findMany({
        select: { githubRepoId: true },
    });
    const linkedIds = new Set(existing.map((r) => r.githubRepoId));

    const sampleRepos = [
        {
            githubRepoId: "github-repo-3001",
            name: "e-commerce-backend",
            fullName: "acme/e-commerce-backend",
            htmlUrl: "https://github.com/acme/e-commerce-backend",
            cloneUrl: "https://github.com/acme/e-commerce-backend.git",
            defaultBranch: "main",
            language: "TypeScript",
            private: true,
        },
        {
            githubRepoId: "github-repo-3002",
            name: "analytics-pipeline",
            fullName: "acme/analytics-pipeline",
            htmlUrl: "https://github.com/acme/analytics-pipeline",
            cloneUrl: "https://github.com/acme/analytics-pipeline.git",
            defaultBranch: "main",
            language: "Python",
            private: false,
        },
        {
            githubRepoId: "github-repo-3003",
            name: "mobile-app-client",
            fullName: "acme/mobile-app-client",
            htmlUrl: "https://github.com/acme/mobile-app-client",
            cloneUrl: "https://github.com/acme/mobile-app-client.git",
            defaultBranch: "main",
            language: "TypeScript",
            private: true,
        },
    ];

    return sampleRepos.map((r) => ({
        ...r,
        isAlreadyLinked: linkedIds.has(r.githubRepoId),
    }));
}

export interface LinkRepoInput {
    githubRepoId: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    cloneUrl?: string;
    defaultBranch?: string;
    language?: string | null;
    private?: boolean;
    orgId: string;
}

export async function linkRepository(userId: string, input: LinkRepoInput) {
    if (!input.githubRepoId || !input.name || !input.fullName || !input.orgId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields for linking repository');
    }

    const repo = await prisma.repository.upsert({
        where: { githubRepoId: input.githubRepoId },
        update: {
            name: input.name,
            fullName: input.fullName,
            htmlUrl: input.htmlUrl,
            cloneUrl: input.cloneUrl,
            defaultBranch: input.defaultBranch || 'main',
            language: input.language || null,
            private: input.private ?? false,
            isActive: true,
            orgId: input.orgId,
            ownerId: userId,
        },
        create: {
            githubRepoId: input.githubRepoId,
            name: input.name,
            fullName: input.fullName,
            htmlUrl: input.htmlUrl,
            cloneUrl: input.cloneUrl,
            defaultBranch: input.defaultBranch || 'main',
            language: input.language || null,
            private: input.private ?? false,
            isActive: true,
            orgId: input.orgId,
            ownerId: userId,
        },
    });

    return repo;
}

/** Alias kept for backwards-compat with older route files. */
export const listAvailableRepos = getAvailableRepos;

/** Soft-delete (deactivate) a linked repository. */
export async function unlinkRepository(repoId: string, userId: string, role?: string): Promise<void> {
    const repo = await prisma.repository.findUnique({ where: { id: repoId } });
    if (!repo) {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
    }
    await prisma.repository.update({
        where: { id: repoId },
        data: { isActive: false },
    });
}

/** Enqueue a manual on-demand analysis job for a repository. */
export async function triggerManualAnalysis(repoId: string, userId: string, role?: string) {
    const repo = await getActiveRepo(repoId);

    const job = await prisma.analysisJob.create({
        data: {
            repoId,
            status: 'PENDING',
            trigger: 'MANUAL',
            branch: repo.defaultBranch,
            commitSha: 'manual',
        },
    });

    return { jobId: job.id, status: job.status, analysisId: job.id };
}
