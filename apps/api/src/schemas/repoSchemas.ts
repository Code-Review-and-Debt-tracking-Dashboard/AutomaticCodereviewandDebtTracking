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
