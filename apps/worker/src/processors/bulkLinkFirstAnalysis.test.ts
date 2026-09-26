import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { BulkLinkJobData } from '@codehealth/shared';

import { linkRepo } from '@codehealth/github';
import { queueFirstAnalysis } from '../lib/apiClient';
import { bulkLinkProcessor } from './bulkLinkProcessor';

vi.mock('@codehealth/db', () => ({
  prisma: { gitHubCredential: { findUnique: vi.fn().mockResolvedValue({ encryptedAccessToken: 'x' }) } },
}));
vi.mock('../lib/crypto', () => ({ decrypt: () => 'token' }));
vi.mock('@codehealth/github', () => ({ githubClient: vi.fn(), linkRepo: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ queueFirstAnalysis: vi.fn().mockResolvedValue(undefined) }));

const mockedLinkRepo = vi.mocked(linkRepo);
const mockedQueue = vi.mocked(queueFirstAnalysis);

function job(githubRepoIds: number[]) {
  return {
    id: 'bulk-1',
    data: { userId: 'u-1', orgId: 'org-1', githubRepoIds },
    updateProgress: vi.fn(),
  } as unknown as Job<BulkLinkJobData>;
}

describe('bulkLinkProcessor first analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues a first analysis only for repos that were just linked', async () => {
    mockedLinkRepo
      .mockResolvedValueOnce({ status: 'LINKED', repository: { id: 'repo-1', fullName: 'acme/api' } } as any)
      .mockResolvedValueOnce({ status: 'ALREADY_LINKED', fullName: 'acme/web' } as any);

    await bulkLinkProcessor(job([1, 2]));

    expect(mockedQueue).toHaveBeenCalledTimes(1);
    expect(mockedQueue).toHaveBeenCalledWith('repo-1');
  });

  it('still counts the repo as linked when queueing fails', async () => {
    mockedLinkRepo.mockResolvedValueOnce({
      status: 'LINKED',
      repository: { id: 'repo-1', fullName: 'acme/api' },
    } as any);
    mockedQueue.mockRejectedValueOnce(new Error('api down'));

    const result = await bulkLinkProcessor(job([1]));

    expect(result.summary.LINKED).toBe(1);
  });
});
