import type { GateResult } from '@codehealth/shared';

import type { ScoreResult } from './score';

export interface GateConfig {
  minHealthScore: number;
  maxCriticalFindings: number | null;
  maxVulnerabilities: number | null;
  maxDuplicationPct: number | null;
  maxComplexityCount: number | null;
  maxCodeSmellCount: number | null;
  blockPR: boolean;
}

// used when no gate is set, same as the API's defaults
export const DEFAULT_GATE: GateConfig = {
  minHealthScore: 60,
  maxCriticalFindings: null,
  maxVulnerabilities: null,
  maxDuplicationPct: null,
  maxComplexityCount: null,
  maxCodeSmellCount: null,
  blockPR: false,
};

export interface GateMetric {
  key: string;
  label: string;
  value: number;
  threshold: number;
  // min = must reach it, max = must stay under it
  comparison: 'min' | 'max';
  passed: boolean;
}

export interface GateEvaluation {
  result: GateResult;
  blockPR: boolean;
  metrics: GateMetric[];
}

export interface GateInput {
  // null = use defaults
  gate: GateConfig | null;
  score: ScoreResult;
}

// PASS/FAIL against the thresholds. null thresholds are skipped
export function evaluateGate({ gate, score }: GateInput): GateEvaluation {
  const config = gate ?? DEFAULT_GATE;

  const checks: Array<Omit<GateMetric, 'passed'> | null> = [
    config.maxCriticalFindings === null
      ? null
      : {
          key: 'criticalFindings',
          label: 'Critical findings',
          value: score.criticalCount,
          threshold: config.maxCriticalFindings,
          comparison: 'max',
        },
    config.maxVulnerabilities === null
      ? null
      : {
          key: 'vulnerabilities',
          label: 'Vulnerabilities',
          value: score.vulnerabilityCount,
          threshold: config.maxVulnerabilities,
          comparison: 'max',
        },
    config.maxDuplicationPct === null
      ? null
      : {
          key: 'duplication',
          label: 'Duplication',
          value: score.duplicationPct,
          threshold: config.maxDuplicationPct,
          comparison: 'max',
        },
    {
      key: 'healthScore',
      label: 'Health Score',
      value: score.healthScore,
      threshold: config.minHealthScore,
      comparison: 'min',
    },
    config.maxComplexityCount === null
      ? null
      : {
          key: 'complexity',
          label: 'Complexity issues',
          value: score.complexityCount,
          threshold: config.maxComplexityCount,
          comparison: 'max',
        },
    config.maxCodeSmellCount === null
      ? null
      : {
          key: 'codeSmells',
          label: 'Code smells',
          value: score.codeSmellCount,
          threshold: config.maxCodeSmellCount,
          comparison: 'max',
        },
  ];

  const metrics: GateMetric[] = checks
    .filter((check): check is Omit<GateMetric, 'passed'> => check !== null)
    .map((check) => ({
      ...check,
      // equal to the threshold passes
      passed:
        check.comparison === 'min'
          ? check.value >= check.threshold
          : check.value <= check.threshold,
    }));

  return {
    result: metrics.every((metric) => metric.passed) ? 'PASS' : 'FAIL',
    blockPR: config.blockPR,
    metrics,
  };
}
