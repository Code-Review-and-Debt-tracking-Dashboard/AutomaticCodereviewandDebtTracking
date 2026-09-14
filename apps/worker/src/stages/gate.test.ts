import { describe, it, expect } from 'vitest';
import { DEFAULT_GATE, evaluateGate, type GateConfig } from './gate';
import type { ScoreResult } from './score';

function score(overrides: Partial<ScoreResult> = {}): ScoreResult {
  return {
    healthScore: 80,
    debtMinutes: 120,
    totalIssues: 10,
    vulnerabilityCount: 0,
    complexityCount: 0,
    duplicationCount: 0,
    codeSmellCount: 0,
    maintainabilityCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    duplicationPct: 0,
    penaltyBreakdown: { findingPenalty: 0, duplicationPenalty: 0, totalPenalty: 0 },
    ...overrides,
  };
}

function gate(overrides: Partial<GateConfig> = {}): GateConfig {
  return { ...DEFAULT_GATE, ...overrides };
}

describe('evaluateGate', () => {
  it('falls back to the defaults when the repo has no gate', () => {
    expect(evaluateGate({ gate: null, score: score({ healthScore: 59.9 }) }).result).toBe('FAIL');
    expect(evaluateGate({ gate: null, score: score({ healthScore: 60 }) }).result).toBe('PASS');
  });

  it('reports only the health score when no other threshold is set', () => {
    const evaluation = evaluateGate({ gate: null, score: score() });

    expect(evaluation.metrics.map((m) => m.key)).toEqual(['healthScore']);
  });

  it('passes a threshold that is met exactly', () => {
    const evaluation = evaluateGate({
      gate: gate({ maxCriticalFindings: 3 }),
      score: score({ criticalCount: 3 }),
    });

    expect(evaluation.result).toBe('PASS');
  });

  it('fails on one breach even with a healthy score', () => {
    const evaluation = evaluateGate({
      gate: gate({ maxDuplicationPct: 5 }),
      score: score({ healthScore: 95, duplicationPct: 8.1 }),
    });

    expect(evaluation.result).toBe('FAIL');
    expect(evaluation.metrics.find((m) => m.key === 'duplication')?.passed).toBe(false);
    expect(evaluation.metrics.find((m) => m.key === 'healthScore')?.passed).toBe(true);
  });

  it('enforces a zero threshold rather than treating it as unset', () => {
    const evaluation = evaluateGate({
      gate: gate({ maxCriticalFindings: 0 }),
      score: score({ criticalCount: 1 }),
    });

    expect(evaluation.result).toBe('FAIL');
    expect(evaluation.metrics.map((m) => m.key)).toContain('criticalFindings');
  });

  it('counts a critical vulnerability against both thresholds', () => {
    const evaluation = evaluateGate({
      gate: gate({ maxCriticalFindings: 0, maxVulnerabilities: 0 }),
      score: score({ criticalCount: 1, vulnerabilityCount: 1 }),
    });

    expect(evaluation.metrics.find((m) => m.key === 'criticalFindings')?.passed).toBe(false);
    expect(evaluation.metrics.find((m) => m.key === 'vulnerabilities')?.passed).toBe(false);
  });

  it('carries blockPR through from the config', () => {
    expect(evaluateGate({ gate: gate({ blockPR: true }), score: score() }).blockPR).toBe(true);
    expect(evaluateGate({ gate: null, score: score() }).blockPR).toBe(false);
  });
});
