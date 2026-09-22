import { describe, it, expect } from 'vitest';
import type { AnalysisFinding } from '@codehealth/shared';

import { buildResultsPayload } from './analysisProcessor';
import type { ScoreResult } from '../stages/score';

function score(overrides: Partial<ScoreResult> = {}): ScoreResult {
  return {
    healthScore: 82.5,
    debtMinutes: 120,
    totalIssues: 7,
    vulnerabilityCount: 1,
    complexityCount: 2,
    duplicationCount: 0,
    codeSmellCount: 3,
    maintainabilityCount: 1,
    criticalCount: 1,
    highCount: 2,
    mediumCount: 3,
    lowCount: 1,
    duplicationPct: 4.2,
    penaltyBreakdown: { findingPenalty: 15, duplicationPenalty: 2.5, totalPenalty: 17.5 },
    ...overrides,
  };
}

function finding(overrides: Partial<AnalysisFinding> = {}): AnalysisFinding {
  return {
    file: 'src/foo.ts',
    line: 1,
    endLine: 1,
    column: null,
    endColumn: null,
    severity: 'MEDIUM',
    category: 'CODE_SMELL',
    state: 'NEW',
    rule: 'some-rule',
    message: 'issue',
    tool: 'eslint',
    debtMinutes: 5,
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildResultsPayload>[0]> = {}) {
  return buildResultsPayload({
    analysisId: 'analysis-1',
    commitSha: 'abc123',
    findings: [finding()],
    score: score(),
    debtDeltaMinutes: -30,
    gateResult: 'PASS',
    linesOfCode: 5000,
    analysisLimited: false,
    ...overrides,
  });
}

describe('buildResultsPayload', () => {
  it('carries every score metric onto the snapshot', () => {
    const { metrics } = build();

    expect(metrics).toEqual({
      healthScore: 82.5,
      debtMinutes: 120,
      debtDeltaMinutes: -30,
      totalIssues: 7,
      vulnerabilityCount: 1,
      complexityCount: 2,
      duplicationCount: 0,
      codeSmellCount: 3,
      maintainabilityCount: 1,
      criticalCount: 1,
      highCount: 2,
      mediumCount: 3,
      lowCount: 1,
      duplicationPct: 4.2,
      linesOfCode: 5000,
      gateResult: 'PASS',
    });
  });

  it('leaves the penalty breakdown out — it is workings, not a stored metric', () => {
    expect(build().metrics).not.toHaveProperty('penaltyBreakdown');
  });

  it('records the gate result so the run can be explained later', () => {
    expect(build({ gateResult: 'FAIL' }).metrics.gateResult).toBe('FAIL');
  });

  it('sends the sha that was checked out, not the one that was queued', () => {
    expect(build({ commitSha: 'deadbeef' }).commitSha).toBe('deadbeef');
  });

  it('passes findings through with the state the matcher gave them', () => {
    const payload = build({ findings: [finding({ state: 'EXISTING' })] });

    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0].state).toBe('EXISTING');
  });

  it('flags a run that had nothing it could analyse', () => {
    expect(build({ analysisLimited: true }).analysisLimited).toBe(true);
  });

  it('sends no tool versions yet', () => {
    expect(build().toolVersions).toEqual({});
  });
});
