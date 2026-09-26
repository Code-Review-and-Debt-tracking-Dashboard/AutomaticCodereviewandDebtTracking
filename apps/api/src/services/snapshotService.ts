import { prisma, Prisma, FindingCategory, Severity } from '@codehealth/db';

import { AppError } from '../middleware/errorHandler';

interface FindingsQuery {
    category?: unknown;
    severity?: unknown;
    isNew?: unknown;
    file?: unknown;
    page?: unknown;
    limit?: unknown;
}

const SEVERITY_KEYS: Record<string, string> = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    INFO: 'info',
};

const CATEGORY_KEYS: Record<string, string> = {
    VULNERABILITY: 'vulnerability',
    COMPLEXITY: 'complexity',
    DUPLICATION: 'duplication',
    CODE_SMELL: 'code_smell',
    MAINTAINABILITY: 'maintainability',
};

async function getSnapshotForAccessCheck(snapshotId: string) {
    const snapshot = await prisma.healthSnapshot.findUnique({
        where: { id: snapshotId },
        select: {
            id: true,
            repoId: true,
            repository: {
                select: {
                    isActive: true,
                    orgId: true,
                    ownerId: true,
                    organization: {
                        select: {
                            members: { select: { userId: true, role: true, status: true } },
                        },
                    },
                    members: {
                        select: { userId: true, role: true, status: true },
                    },
                },
            },
        },
    });

    if (!snapshot || !snapshot.repository.isActive) {
        throw new AppError(404, 'NOT_FOUND', 'Snapshot not found');
    }

    return snapshot;
}

// Mirrors the read-access rule in requireRepoAccess, keyed off the snapshot's
// repo instead of a :repoId route param.
function assertReadAccess(
    userId: string,
    repository: Awaited<ReturnType<typeof getSnapshotForAccessCheck>>['repository'],
): void {
    const orgMembership = repository.organization.members.find((m) => m.userId === userId);
    if (orgMembership?.status !== 'ACTIVE') {
        throw new AppError(404, 'NOT_FOUND', 'Snapshot not found');
    }

    const isOrgManager = orgMembership.role === 'OWNER' || orgMembership.role === 'ADMIN';
    if (repository.ownerId === userId || isOrgManager) {
        return;
    }

    const membership = repository.members.find((m) => m.userId === userId);
    if (membership?.status !== 'ACTIVE') {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this repository');
    }
}

function resolveCategory(query: FindingsQuery): string | undefined {
    const raw = typeof query.category === 'string' ? query.category.toUpperCase() : undefined;
    if (raw === undefined) return undefined;
    if (!(raw in CATEGORY_KEYS)) {
        throw new AppError(400, 'VALIDATION_ERROR', '"category" is not a valid finding category');
    }
    return raw;
}

function resolveSeverity(query: FindingsQuery): string | undefined {
    const raw = typeof query.severity === 'string' ? query.severity.toUpperCase() : undefined;
    if (raw === undefined) return undefined;
    if (!(raw in SEVERITY_KEYS)) {
        throw new AppError(400, 'VALIDATION_ERROR', '"severity" is not a valid severity');
    }
    return raw;
}

function resolveIsNew(query: FindingsQuery): boolean | undefined {
    if (typeof query.isNew !== 'string') return undefined;
    if (query.isNew === 'true') return true;
    if (query.isNew === 'false') return false;
    throw new AppError(400, 'VALIDATION_ERROR', '"isNew" must be "true" or "false"');
}

function resolvePagination(query: FindingsQuery): { page: number; limit: number } {
    const pageRaw = typeof query.page === 'string' ? query.page : undefined;
    const page = pageRaw === undefined ? 1 : Number(pageRaw);
    if (!Number.isInteger(page) || page <= 0) {
        throw new AppError(400, 'VALIDATION_ERROR', '"page" must be a positive integer');
    }

    const limitRaw = typeof query.limit === 'string' ? query.limit : undefined;
    const limit = limitRaw === undefined ? 50 : Number(limitRaw);
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
        throw new AppError(400, 'VALIDATION_ERROR', '"limit" must be an integer between 1 and 100');
    }

    return { page, limit };
}

export async function getSnapshotFindings(snapshotId: string, userId: string, query: FindingsQuery) {
    const snapshot = await getSnapshotForAccessCheck(snapshotId);
    assertReadAccess(userId, snapshot.repository);

    const category = resolveCategory(query);
    const severity = resolveSeverity(query);
    const isNew = resolveIsNew(query);
    const file = typeof query.file === 'string' ? query.file : undefined;
    const { page, limit } = resolvePagination(query);

    // summary reflects category/severity/file filters only, so toggling isNew
    // (a view of the same data) doesn't change the new/carryOver breakdown.
    const summaryWhere: Prisma.FindingWhereInput = {
        snapshotId,
        ...(category ? { category: category as FindingCategory } : {}),
        ...(severity ? { severity: severity as Severity } : {}),
        ...(file ? { file: { contains: file } } : {}),
    };

    const dataWhere: Prisma.FindingWhereInput = {
        ...summaryWhere,
        ...(isNew !== undefined ? { state: isNew ? 'NEW' : 'EXISTING' } : {}),
    };

    const [total, newCount, bySeverityRows, byCategoryRows, filteredTotal, findings] = await Promise.all([
        prisma.finding.count({ where: summaryWhere }),
        prisma.finding.count({ where: { ...summaryWhere, state: 'NEW' } }),
        prisma.finding.groupBy({ by: ['severity'], where: summaryWhere, _count: true }),
        prisma.finding.groupBy({ by: ['category'], where: summaryWhere, _count: true }),
        prisma.finding.count({ where: dataWhere }),
        prisma.finding.findMany({
            where: dataWhere,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const row of bySeverityRows) {
        bySeverity[SEVERITY_KEYS[row.severity]] = row._count;
    }

    const byCategory: Record<string, number> = {
        vulnerability: 0,
        complexity: 0,
        duplication: 0,
        code_smell: 0,
        maintainability: 0,
    };
    for (const row of byCategoryRows) {
        byCategory[CATEGORY_KEYS[row.category]] = row._count;
    }

    return {
        snapshotId,
        summary: {
            total,
            new: newCount,
            carryOver: total - newCount,
            bySeverity,
            byCategory,
        },
        data: findings.map((f) => ({
            id: f.id,
            file: f.file,
            line: f.line,
            endLine: f.endLine,
            severity: f.severity,
            category: f.category,
            rule: f.rule,
            message: f.message,
            tool: f.tool,
            isNew: f.state === 'NEW',
            debtMinutes: f.debtMinutes,
        })),
        pagination: {
            page,
            limit,
            total: filteredTotal,
            totalPages: Math.max(1, Math.ceil(filteredTotal / limit)),
        },
    };
}
