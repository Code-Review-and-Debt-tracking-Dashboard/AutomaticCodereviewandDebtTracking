import type { GateResult } from '@codehealth/shared';

import type { ScoreResult } from './score';

// Thresholds as they come off the repo's quality gate row. Declared here rather
// than imported from the db package so the stage stays pure.
export interface GateConfig {
  minHealthScore: number;
  maxCriticalFindings: number | null;
  maxVulnerabilities: number | null;
  maxDuplicationPct: number | null;
  maxComplexityCount: number | null;
  maxCodeSmellCount: number | null;
  blockPR: boolean;
}

// What a repo is held to before anyone configures a gate. Same numbers the API
// hands back from GET /api/repos/:repoId/quality-gate.
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
  // 'min' means the value has to reach the threshold, 'max' means it has to stay under.
  comparison: 'min' | 'max';
  passed: boolean;
}

export interface GateEvaluation {
  result: GateResult;
  blockPR: boolean;
  // Only the metrics that actually have a threshold set.
  metrics: GateMetric[];
}

export interface GateInput {
  // Null when the repo has no gate configured, which falls back to the defaults.
  gate: GateConfig | null;
  score: ScoreResult;
}

/**
 * Compares this run's numbers against the repo's thresholds and returns PASS or
 * FAIL plus the row behind each comparison, so the PR comment can show why.
 *
 * A null threshold means nobody set that limit, so the metric is left out
 * entirely rather than reported as passing. Critical findings and
 * vulnerabilities are separate checks — one finding can trip both.
 *
 * Debt is deliberately not here. There is no debt threshold to compare against,
 * so it stays a trend number and never decides the verdict.
 *
 * Pure — same score and same config, same verdict, every time.
 */
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
      // Hitting the threshold exactly is fine on both sides.
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
