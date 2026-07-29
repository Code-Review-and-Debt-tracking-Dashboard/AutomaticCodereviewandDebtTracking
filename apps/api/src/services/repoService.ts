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