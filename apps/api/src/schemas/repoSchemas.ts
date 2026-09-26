import { z } from 'zod';

export const linkRepositorySchema = z.object({
  body: z.object({
    githubRepoId: z.coerce.number().int().positive('GitHub repository id is required'),
  }),
});
export const addMemberSchema = z.object({
  body: z.object({
    username: z.string().trim().min(1, 'must be a non-empty string'),
    role: z.enum(['TEAM_LEAD', 'DEVELOPER', 'VIEWER']).optional().default('DEVELOPER'),
  }),
  params: z.object({
    repoId: z.string(),
  }),
});

export const bulkLinkSchema = z.object({
  params: z.object({
    orgId: z.string().min(1),
  }),
  body: z.object({
    // Capped so one request can't queue an unbounded batch.
    githubRepoIds: z
      .array(z.coerce.number().int().positive())
      .min(1, 'Pick at least one repository')
      .max(200, 'At most 200 repositories at a time'),
  }),
});

export const bulkLinkStatusSchema = z.object({
  params: z.object({
    orgId: z.string().min(1),
    jobId: z.string().min(1),
  }),
});
