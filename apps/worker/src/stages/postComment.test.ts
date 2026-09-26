import type { Octokit } from '@codehealth/github';
import { describe, it, expect } from 'vitest';

import { type CommentTarget, upsertComment } from './postComment';

interface Call {
  method: 'create' | 'update';
  args: Record<string, unknown>;
}

// Hand-rolled stand-in for the two endpoints the poster touches, so the tests
// never go near the network.
function fakeOctokit(options: { newId?: number; updateError?: unknown } = {}) {
  const calls: Call[] = [];
  const { newId = 111, updateError } = options;

  const octokit = {
    rest: {
      issues: {
        async createComment(args: Record<string, unknown>) {
          calls.push({ method: 'create', args });
          return { data: { id: newId } };
        },
        async updateComment(args: Record<string, unknown>) {
          calls.push({ method: 'update', args });
          if (updateError) throw updateError;
          return { data: { id: args.comment_id } };
        },
      },
    },
  };

  return { octokit: octokit as unknown as Octokit, calls };
}

function target(overrides: Partial<CommentTarget> = {}): CommentTarget {
  return { owner: 'acme', repo: 'widgets', prNumber: 7, botCommentId: null, ...overrides };
}

describe('upsertComment', () => {
  it('creates a comment when the PR has none yet', async () => {
    const { octokit, calls } = fakeOctokit({ newId: 555 });

    const id = await upsertComment(octokit, target(), 'body');

    expect(id).toBe('555');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('create');
    expect(calls[0].args).toMatchObject({
      owner: 'acme',
      repo: 'widgets',
      issue_number: 7,
      body: 'body',
    });
  });

  it('edits the existing comment instead of posting a second one', async () => {
    const { octokit, calls } = fakeOctokit();

    const id = await upsertComment(octokit, target({ botCommentId: '42' }), 'body');

    expect(id).toBe('42');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('update');
    expect(calls[0].args).toMatchObject({ comment_id: 42, body: 'body' });
  });

  it('posts a new comment when the stored one was deleted', async () => {
    const { octokit, calls } = fakeOctokit({ newId: 999, updateError: { status: 404 } });

    const id = await upsertComment(octokit, target({ botCommentId: '42' }), 'body');

    expect(id).toBe('999');
    expect(calls.map((c) => c.method)).toEqual(['update', 'create']);
  });

  it('gives up on an error that is not a missing comment', async () => {
    const { octokit, calls } = fakeOctokit({ updateError: { status: 403 } });

    await expect(upsertComment(octokit, target({ botCommentId: '42' }), 'body')).rejects.toEqual({
      status: 403,
    });

    expect(calls.map((c) => c.method)).toEqual(['update']);
  });
});
