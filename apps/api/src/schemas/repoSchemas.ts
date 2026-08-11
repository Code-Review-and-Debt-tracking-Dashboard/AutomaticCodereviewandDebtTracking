import { z } from 'zod';

export const linkRepositorySchema = z.object({
  body: z.object({
    orgId: z.string().optional(),
    name: z.string().min(1, 'Name is required'),
    fullName: z.string().min(1, 'Full name is required'),
    url: z.string().url('Must be a valid URL').optional(),
  }).passthrough(),
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
