import { describe, it, expect } from 'vitest';
import type { AnalysisFinding, SnapshotMetrics } from '@codehealth/shared';
import {
  COMMENT_MARKER,
  buildPrComment,
  debtByCategory,
  formatMinutes,
  scoreBand,
} from './comment';

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

function metrics(overrides: Partial<SnapshotMetrics> = {}): SnapshotMetrics {
  return {
    healthScore: 100,
    debtMinutes: 0,
    debtDeltaMinutes: 0,
    vulnerabilityCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    complexityCount: 0,
    duplicationCount: 0,
    codeSmellCount: 0,
    maintainabilityCount: 0,
    duplicationPct: 0,
    totalIssues: 0,
    linesOfCode: 500,
    gateResult: null,
    ...overrides,
  };
}

describe('formatMinutes', () => {
  it('formats zero, whole hours, and mixed durations', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(380)).toBe('6h 20m');
  });

  it('ignores the sign so callers can prefix their own', () => {
    expect(formatMinutes(-15)).toBe('15m');
  });
});

describe('scoreBand', () => {
  it('maps each boundary from scoring_algorithm.md §7', () => {
    expect(scoreBand(100).label).toBe('Excellent');
    expect(scoreBand(90).label).toBe('Excellent');
    expect(scoreBand(89.9).label).toBe('Good');
    expect(scoreBand(70).label).toBe('Good');
    expect(scoreBand(69.9).label).toBe('Fair');
    expect(scoreBand(50).label).toBe('Fair');
    expect(scoreBand(49.9).label).toBe('Poor');
    expect(scoreBand(25).label).toBe('Poor');
    expect(scoreBand(24.9).label).toBe('Critical');
    expect(scoreBand(0).label).toBe('Critical');
  });
});

describe('debtByCategory', () => {
  it('sums count and minutes per category', () => {
    const totals = debtByCategory([
      finding({ category: 'VULNERABILITY', debtMinutes: 60 }),
      finding({ category: 'VULNERABILITY', debtMinutes: 30 }),
      finding({ category: 'CODE_SMELL', debtMinutes: 5 }),
    ]);

    expect(totals.VULNERABILITY).toEqual({ count: 2, minutes: 90 });
    expect(totals.CODE_SMELL).toEqual({ count: 1, minutes: 5 });
    expect(totals.COMPLEXITY).toEqual({ count: 0, minutes: 0 });
  });
});

describe('buildPrComment', () => {
  it('renders a clean first analysis with no findings', () => {
    const body = buildPrComment({ metrics: metrics(), findings: [], baseline: null });
    const lines = body.split('\n');

    expect(lines[0]).toBe(COMMENT_MARKER);
    expect(lines[1]).toBe('## CodeHealth — Health Score 100');
    expect(body).toContain('🟢 **Excellent**');
    expect(body).toContain('### Technical debt: 0m (first analysis, no baseline)');
    expect(body).toContain('No findings — nothing to remediate.');
    expect(body).not.toContain('| Category |');
  });

  it('flags increased debt with a warning and an up arrow', () => {
    const body = buildPrComment({
      metrics: metrics({ debtMinutes: 380, debtDeltaMinutes: 45 }),
      findings: [finding()],
      baseline: { healthScore: 80 },
    });

    expect(body).toContain('### Technical debt: 6h 20m (⚠️ ▲ +45m since last analysis)');
  });

  it('marks decreased debt as good with a down arrow', () => {
    const body = buildPrComment({
      metrics: metrics({ debtMinutes: 200, debtDeltaMinutes: -15 }),
      findings: [finding()],
      baseline: { healthScore: 80 },
    });

    expect(body).toContain('(✅ ▼ -15m since last analysis)');
  });

  it('reports unchanged debt when the delta is zero and a baseline exists', () => {
    const body = buildPrComment({
      metrics: metrics({ debtMinutes: 200, debtDeltaMinutes: 0 }),
      findings: [finding()],
      baseline: { healthScore: 80 },
    });

    expect(body).toContain('(✅ no change since last analysis)');
  });

  it('shows the health score delta against the baseline in the heading', () => {
    const down = buildPrComment({
      metrics: metrics({ healthScore: 72.4 }),
      findings: [],
      baseline: { healthScore: 76.5 },
    });
    expect(down).toContain('## CodeHealth — Health Score 72.4 ▼ 4.1');

    const up = buildPrComment({
      metrics: metrics({ healthScore: 80 }),
      findings: [],
      baseline: { healthScore: 76.5 },
    });
    expect(up).toContain('## CodeHealth — Health Score 80 ▲ +3.5');

    const same = buildPrComment({
      metrics: metrics({ healthScore: 80 }),
      findings: [],
      baseline: { healthScore: 80 },
    });
    expect(same).toContain('## CodeHealth — Health Score 80\n');
  });

  it('omits the heading arrow when there is no baseline', () => {
    const body = buildPrComment({
      metrics: metrics({ healthScore: 72.4 }),
      findings: [],
      baseline: null,
    });

    expect(body).toContain('## CodeHealth — Health Score 72.4\n');
    expect(body).not.toContain('▼');
    expect(body).not.toContain('▲');
  });

  it('restates the stored gate result and omits it when no gate is configured', () => {
    const failed = buildPrComment({
      metrics: metrics({ healthScore: 55, gateResult: 'FAIL' }),
      findings: [],
      baseline: null,
    });
    expect(failed).toContain('🟠 **Fair** · Quality gate: **FAILED**');

    const passed = buildPrComment({
      metrics: metrics({ healthScore: 95, gateResult: 'PASS' }),
      findings: [],
      baseline: null,
    });
    expect(passed).toContain('🟢 **Excellent** · Quality gate: **PASSED**');

    const none = buildPrComment({ metrics: metrics(), findings: [], baseline: null });
    expect(none).not.toContain('Quality gate');
  });

  it('renders one debt row per category with findings, in fixed order', () => {
    const body = buildPrComment({
      metrics: metrics({ debtMinutes: 145 }),
      findings: [
        finding({ category: 'CODE_SMELL', debtMinutes: 5 }),
        finding({ category: 'VULNERABILITY', debtMinutes: 60 }),
        finding({ category: 'CODE_SMELL', debtMinutes: 20 }),
        finding({ category: 'COMPLEXITY', debtMinutes: 60 }),
      ],
      baseline: null,
    });

    const rows = body.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Category'));
    expect(rows).toEqual([
      '| Vulnerabilities | 1 | 1h |',
      '| Complexity | 1 | 1h |',
      '| Code smells | 2 | 25m |',
    ]);
    expect(body).not.toContain('Duplication');
    expect(body).not.toContain('Maintainability');
  });
});
