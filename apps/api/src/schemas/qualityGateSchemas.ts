import { z } from 'zod';

export const updateQualityGateSchema = z.object({
  body: z.object({
    minHealthScore: z.number().min(0).max(100).optional().default(60),
    maxCriticalFindings: z.number().nullable().optional(),
    maxVulnerabilities: z.number().nullable().optional(),
    maxDuplicationPct: z.number().nullable().optional(),
    maxComplexityCount: z.number().nullable().optional(),
    maxCodeSmellCount: z.number().nullable().optional(),
    blockPR: z.boolean().optional().default(false),
  }),
  params: z.object({
    repoId: z.string(),
  }),
});
