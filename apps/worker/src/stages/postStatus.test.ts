import type { Octokit } from '@codehealth/github';
import { describe, it, expect } from 'vitest';

import type { GateEvaluation, GateMetric } from './gate';
import { type StatusTarget, createGateStatus } from './postStatus';

function fakeOctokit() {
  const calls: Record<string, unknown>[] = [];

  const octokit = {
    rest: {
      repos: {
        async createCommitStatus(args: Record<string, unknown>) {
          calls.push(args);
          return { data: { id: 1 } };
        },
      },
    },
  };

  return { octokit: octokit as unknown as Octokit, calls };
}

function metric(overrides: Partial<GateMetric> = {}): GateMetric {
  return {
    key: 'healthScore',
    label: 'Health Score',
    value: 82,
    threshold: 60,
    comparison: 'min',
    passed: true,
    ...overrides,
  };
}

function evaluation(overrides: Partial<GateEvaluation> = {}): GateEvaluation {
  return {
    result: 'PASS',
    blockPR: false,
    metrics: [metric()],
    ...overrides,
  };
}

function target(overrides: Partial<StatusTarget> = {}): StatusTarget {
  return { owner: 'acme', repo: 'widgets', sha: 'abc123', ...overrides };
}

describe('createGateStatus', () => {
  it('marks the commit green when the gate passed', async () => {
    const { octokit, calls } = fakeOctokit();

    await createGateStatus(octokit, target(), evaluation());

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      owner: 'acme',
      repo: 'widgets',
      sha: 'abc123',
      state: 'success',
      context: 'codepulse/quality-gate',
    });
  });

  it('marks the commit red when the gate failed', async () => {
    const { octokit, calls } = fakeOctokit();

    await createGateStatus(
      octokit,
      target(),
      evaluation({ result: 'FAIL', metrics: [metric({ passed: false })] }),
    );

    expect(calls[0]).toMatchObject({ state: 'failure' });
  });

  it('says how many checks broke', async () => {
    const { octokit, calls } = fakeOctokit();

    await createGateStatus(
      octokit,
      target(),
      evaluation({
        result: 'FAIL',
        metrics: [
          metric({ passed: false }),
          metric({ key: 'vulnerabilities', passed: false }),
          metric({ key: 'duplication' }),
          metric({ key: 'codeSmells' }),
        ],
      }),
    );

    expect(calls[0]).toMatchObject({ description: '2 of 4 checks failed' });
  });

  it('says how many checks held when everything passed', async () => {
    const { octokit, calls } = fakeOctokit();

    await createGateStatus(
      octokit,
      target(),
      evaluation({ metrics: [metric(), metric({ key: 'duplication' })] }),
    );

    expect(calls[0]).toMatchObject({ description: 'All 2 checks passed' });
  });

  it('still reports a failure on a repo that does not block PRs', async () => {
    const { octokit, calls } = fakeOctokit();

    await createGateStatus(
      octokit,
      target(),
      evaluation({ result: 'FAIL', blockPR: false, metrics: [metric({ passed: false })] }),
    );

    expect(calls[0]).toMatchObject({ state: 'failure' });
  });
});
