import { describe, it, expect } from 'vitest';

import { closedUpdate } from './prSyncProcessor';

describe('closedUpdate', () => {
  it('leaves a PR that is still open on github alone', () => {
    expect(closedUpdate({ state: 'open', merged_at: null, closed_at: null })).toBeNull();
  });

  it('marks a merged PR as MERGED', () => {
    const update = closedUpdate({
      state: 'closed',
      merged_at: '2026-10-01T16:47:49Z',
      closed_at: '2026-10-01T16:47:49Z',
    });

    expect(update?.status).toBe('MERGED');
    expect(update?.mergedAt?.toISOString()).toBe('2026-10-01T16:47:49.000Z');
  });

  it('marks a PR closed without merging as CLOSED', () => {
    const update = closedUpdate({ state: 'closed', merged_at: null, closed_at: '2026-10-01T16:40:43Z' });

    expect(update?.status).toBe('CLOSED');
    expect(update?.mergedAt).toBeNull();
    expect(update?.closedAt?.toISOString()).toBe('2026-10-01T16:40:43.000Z');
  });
});
