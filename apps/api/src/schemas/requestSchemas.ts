import { z } from 'zod';

const id = z.string().trim().min(1);

export const repoIdParamsSchema = z.object({
  params: z.object({ repoId: id }),
});

export const snapshotIdParamsSchema = z.object({
  params: z.object({ snapshotId: id }),
});

export const notificationIdParamsSchema = z.object({
  params: z.object({ notificationId: id }),
});

export const orgIdParamsSchema = z.object({
  params: z.object({ orgId: id }),
});

export const prParamsSchema = z.object({
  params: z.object({ repoId: id, prNumber: z.coerce.number().int().positive() }),
});

export const memberParamsSchema = z.object({
  params: z.object({ repoId: id, userId: id }),
});

export const refreshTokenBodySchema = z.object({
  body: z.object({ refreshToken: z.string().trim().min(1).optional() }).passthrough().optional().default({}),
});

export const devLoginBodySchema = z.object({
  body: z.object({ username: z.string().trim().min(1) }),
});

const optionalNumericString = z.string().regex(/^\d+$/).optional();

export const availableReposQuerySchema = z.object({
  query: z.object({ orgId: id.optional() }).passthrough(),
});

export const trendQuerySchema = z.object({
  query: z.object({
    days: optionalNumericString,
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).passthrough(),
});

export const hotspotsQuerySchema = z.object({
  query: z.object({ limit: optionalNumericString, snapshotId: id.optional() }).passthrough(),
});

export const findingsQuerySchema = z.object({
  query: z.object({
    category: z.string().trim().min(1).optional(),
    severity: z.string().trim().min(1).optional(),
    isNew: z.enum(['true', 'false']).optional(),
    file: z.string().optional(),
    page: optionalNumericString,
    limit: optionalNumericString,
  }).passthrough(),
});
