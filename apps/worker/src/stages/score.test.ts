import { describe, it, expect } from 'vitest';
import type { AnalysisFinding } from '@codehealth/shared';
import { DEBT_COST_TABLE } from './normalize';
import { computeScore } from './score';

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

describe('computeScore', () => {
  it('returns a perfect score when there are no findings and no duplication', () => {
    const result = computeScore({ findings: [], duplicationPct: 0, linesOfCode: 500 });

    expect(result.healthScore).toBe(100);
    expect(result.totalIssues).toBe(0);
    expect(result.penaltyBreakdown.totalPenalty).toBe(0);
  });

  it('charges BASE_PENALTY * category weight * severity multiplier for a single finding', () => {
    // MEDIUM / CODE_SMELL: 0.5 * 1.0 * 1.0 = 0.5
    const result = computeScore({
      findings: [finding({ severity: 'MEDIUM', category: 'CODE_SMELL' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });

    expect(result.penaltyBreakdown.findingPenalty).toBeCloseTo(0.5, 5);
    expect(result.healthScore).toBe(99.5);
  });

  it('weighs a VULNERABILITY finding more heavily than a CODE_SMELL finding of the same severity', () => {
    const vuln = computeScore({
      findings: [finding({ category: 'VULNERABILITY', severity: 'MEDIUM' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });
    const smell = computeScore({
      findings: [finding({ category: 'CODE_SMELL', severity: 'MEDIUM' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });

    // CATEGORY_WEIGHTS: VULNERABILITY 4.0 vs CODE_SMELL 1.0
    expect(vuln.penaltyBreakdown.findingPenalty).toBeCloseTo(smell.penaltyBreakdown.findingPenalty * 4, 5);
  });

  it('weighs a CRITICAL finding more heavily than a LOW finding of the same category', () => {
    const critical = computeScore({
      findings: [finding({ severity: 'CRITICAL' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });
    const low = computeScore({
      findings: [finding({ severity: 'LOW' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });

    // SEVERITY_MULTIPLIERS: CRITICAL 3.0 vs LOW 0.5
    expect(critical.penaltyBreakdown.findingPenalty).toBeCloseTo(low.penaltyBreakdown.findingPenalty * 6, 5);
  });

  it('applies diminishing returns to repeats of the same rule', () => {
    const single = computeScore({
      findings: [finding({ rule: 'no-console' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });
    const repeated = computeScore({
      findings: [finding({ rule: 'no-console' }), finding({ rule: 'no-console' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });

    // Second occurrence is discounted (1 / (1 + 0.3)), so two repeats cost
    // less than double a single occurrence.
    expect(repeated.penaltyBreakdown.findingPenalty).toBeLessThan(
      single.penaltyBreakdown.findingPenalty * 2,
    );
    expect(repeated.penaltyBreakdown.findingPenalty).toBeGreaterThan(
      single.penaltyBreakdown.findingPenalty,
    );
  });

  it('always charges the worst severity in a rule group first, regardless of input order', () => {
    const lowThenCritical = computeScore({
      findings: [
        finding({ rule: 'shared-rule', severity: 'LOW' }),
        finding({ rule: 'shared-rule', severity: 'CRITICAL' }),
      ],
      duplicationPct: 0,
      linesOfCode: 500,
    });
    const criticalThenLow = computeScore({
      findings: [
        finding({ rule: 'shared-rule', severity: 'CRITICAL' }),
        finding({ rule: 'shared-rule', severity: 'LOW' }),
      ],
      duplicationPct: 0,
      linesOfCode: 500,
    });

    expect(lowThenCritical.healthScore).toBe(criticalThenLow.healthScore);
  });

  it('excludes jscpd duplication findings from the per-finding penalty to avoid double-counting', () => {
    const withJscpd = computeScore({
      findings: [finding({ category: 'DUPLICATION', tool: 'jscpd' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });
    const withOtherTool = computeScore({
      findings: [finding({ category: 'DUPLICATION', tool: 'sonarjs' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });

    expect(withJscpd.penaltyBreakdown.findingPenalty).toBe(0);
    expect(withOtherTool.penaltyBreakdown.findingPenalty).toBeGreaterThan(0);
    // Both are still counted in duplicationCount, just not penalized twice.
    expect(withJscpd.duplicationCount).toBe(1);
  });

  it('scales the finding penalty down for repos larger than the LOC normalization base', () => {
    const findings = [finding(), finding({ rule: 'other-rule' })];

    const smallRepo = computeScore({ findings, duplicationPct: 0, linesOfCode: 500 });
    const largeRepo = computeScore({ findings, duplicationPct: 0, linesOfCode: 5000 });

    expect(largeRepo.penaltyBreakdown.findingPenalty).toBeLessThan(
      smallRepo.penaltyBreakdown.findingPenalty,
    );
  });

  it('clamps duplicationPct into the 0-100 range', () => {
    const negative = computeScore({ findings: [], duplicationPct: -10, linesOfCode: 500 });
    const over = computeScore({ findings: [], duplicationPct: 120, linesOfCode: 500 });

    expect(negative.duplicationPct).toBe(0);
    expect(over.duplicationPct).toBe(100);
  });

  it('never lets the health score drop below 0', () => {
    const manyFindings = Array.from({ length: 100 }, (_, i) =>
      finding({ category: 'VULNERABILITY', severity: 'CRITICAL', rule: `rule-${i}` }),
    );

    const result = computeScore({ findings: manyFindings, duplicationPct: 100, linesOfCode: 100 });

    expect(result.healthScore).toBe(0);
  });

  it('reports counts that match the input findings regardless of penalty math', () => {
    const findings = [
      finding({ category: 'VULNERABILITY', severity: 'CRITICAL' }),
      finding({ category: 'VULNERABILITY', severity: 'HIGH' }),
      finding({ category: 'COMPLEXITY', severity: 'MEDIUM' }),
      finding({ category: 'DUPLICATION', severity: 'LOW', tool: 'jscpd' }),
      finding({ category: 'MAINTAINABILITY', severity: 'INFO' }),
    ];

    const result = computeScore({ findings, duplicationPct: 10, linesOfCode: 500 });

    expect(result.totalIssues).toBe(5);
    expect(result.vulnerabilityCount).toBe(2);
    expect(result.complexityCount).toBe(1);
    expect(result.duplicationCount).toBe(1);
    expect(result.maintainabilityCount).toBe(1);
    expect(result.criticalCount).toBe(1);
    expect(result.highCount).toBe(1);
    expect(result.mediumCount).toBe(1);
    expect(result.lowCount).toBe(1);
  });
});

describe('debt score', () => {
  // The normalizer stamps debtMinutes from the cost table, so do the same here
  // instead of hand-picking numbers the scorer would just trust.
  const costed = (overrides: Partial<AnalysisFinding> = {}): AnalysisFinding => {
    const base = finding(overrides);
    return { ...base, debtMinutes: DEBT_COST_TABLE[base.category][base.severity] };
  };

  it('is zero when there are no findings', () => {
    const result = computeScore({ findings: [], duplicationPct: 0, linesOfCode: 500 });

    expect(result.debtMinutes).toBe(0);
  });

  it('charges the cost table rate for a single finding', () => {
    const result = computeScore({
      findings: [costed({ category: 'VULNERABILITY', severity: 'CRITICAL' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });

    expect(result.debtMinutes).toBe(60);
  });

  it('does not discount repeats of the same rule the way the health score does', () => {
    const findings = Array.from({ length: 20 }, () =>
      costed({ category: 'CODE_SMELL', severity: 'MEDIUM', rule: 'no-console' }),
    );

    const result = computeScore({ findings, duplicationPct: 0, linesOfCode: 1000 });

    // 20 x 5, flat. The health score discounts these, debt doesn't.
    expect(result.debtMinutes).toBe(100);
    expect(result.penaltyBreakdown.findingPenalty).toBeLessThan(20 * 0.5);
  });

  it('sums across categories and severities', () => {
    const findings = [
      costed({ category: 'VULNERABILITY', severity: 'CRITICAL', rule: 'sql-injection' }),
      costed({ category: 'VULNERABILITY', severity: 'HIGH', rule: 'xss' }),
      costed({ category: 'COMPLEXITY', severity: 'MEDIUM', rule: 'complexity' }),
      costed({ category: 'COMPLEXITY', severity: 'MEDIUM', rule: 'complexity' }),
      costed({ category: 'CODE_SMELL', severity: 'LOW', rule: 'no-var' }),
    ];

    const result = computeScore({ findings, duplicationPct: 8.5, linesOfCode: 2000 });

    // 60 + 30 + 15 + 15 + 3
    expect(result.debtMinutes).toBe(123);
  });

  it('counts jscpd duplication findings even though they are left out of the penalty', () => {
    const result = computeScore({
      findings: [costed({ category: 'DUPLICATION', severity: 'MEDIUM', tool: 'jscpd' })],
      duplicationPct: 0,
      linesOfCode: 500,
    });

    expect(result.debtMinutes).toBe(10);
    expect(result.penaltyBreakdown.findingPenalty).toBe(0);
  });

  it('is not scaled down for large repos', () => {
    const findings = [costed({ category: 'VULNERABILITY', severity: 'CRITICAL' })];

    const small = computeScore({ findings, duplicationPct: 0, linesOfCode: 500 });
    const large = computeScore({ findings, duplicationPct: 0, linesOfCode: 50000 });

    expect(large.debtMinutes).toBe(small.debtMinutes);
    expect(large.healthScore).toBeGreaterThan(small.healthScore);
  });
});
