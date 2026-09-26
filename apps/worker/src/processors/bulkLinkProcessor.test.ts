import { describe, it, expect } from 'vitest';

import type { BulkLinkRepoResult, BulkLinkStatus } from '@codehealth/shared';

import { credentialFailureResults, summarize } from './bulkLinkProcessor';

function result(status: BulkLinkStatus, githubRepoId = 1): BulkLinkRepoResult {
  return { githubRepoId, status };
}

describe('summarize', () => {
  it('reports every status as zero when nothing was linked', () => {
    expect(summarize([])).toEqual({
      LINKED: 0,
      ALREADY_LINKED: 0,
      NO_ADMIN: 0,
      NOT_IN_ORG: 0,
      NOT_FOUND: 0,
      NO_CREDENTIAL: 0,
      CREDENTIAL_DECRYPT_FAILED: 0,
      GITHUB_ERROR: 0,
    });
  });

  it('counts a batch that all went the same way', () => {
    const summary = summarize([result('LINKED', 1), result('LINKED', 2), result('LINKED', 3)]);
    expect(summary.LINKED).toBe(3);
    expect(summary.NO_ADMIN).toBe(0);
  });

  it('counts each bucket separately on a partial failure', () => {
    const summary = summarize([
      result('LINKED', 1),
      result('LINKED', 2),
      result('ALREADY_LINKED', 3),
      result('NO_ADMIN', 4),
      result('NO_ADMIN', 5),
      result('GITHUB_ERROR', 6),
    ]);

    expect(summary).toEqual({
      LINKED: 2,
      ALREADY_LINKED: 1,
      NO_ADMIN: 2,
      NOT_IN_ORG: 0,
      NOT_FOUND: 0,
      NO_CREDENTIAL: 0,
      CREDENTIAL_DECRYPT_FAILED: 0,
      GITHUB_ERROR: 1,
    });
  });

  it('keeps a decrypt failure out of the missing-credential bucket', () => {
    const results = credentialFailureResults([1, 2], 'CREDENTIAL_DECRYPT_FAILED');
    const summary = summarize(results);

    expect(summary.CREDENTIAL_DECRYPT_FAILED).toBe(2);
    expect(summary.NO_CREDENTIAL).toBe(0);
    // the whole point: this one must not tell the user to sign in again
    expect(results[0].message).not.toMatch(/sign in/i);
  });

  it('totals back to the number of repos submitted', () => {
    const results = [
      result('LINKED', 1),
      result('NOT_IN_ORG', 2),
      result('NOT_FOUND', 3),
      result('ALREADY_LINKED', 4),
    ];
    const total = Object.values(summarize(results)).reduce((a, b) => a + b, 0);
    expect(total).toBe(results.length);
  });
});
