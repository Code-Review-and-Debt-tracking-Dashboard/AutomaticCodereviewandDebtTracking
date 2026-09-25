import { describe, it, expect } from 'vitest';
import type { AnalysisFinding, QualityGateThresholds, SnapshotMetrics } from '@codehealth/shared';
import {
  COMMENT_MARKER,
  buildPrComment,
  debtByCategory,
  formatMinutes,
  metricRows,
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

function gate(overrides: Partial<QualityGateThresholds> = {}): QualityGateThresholds {
  return {
    minHealthScore: 60,
    maxCriticalFindings: null,
    maxVulnerabilities: null,
    maxDuplicationPct: null,
    maxComplexityCount: null,
    maxCodeSmellCount: null,
    blockPR: false,
    ...overrides,
  };
}

// The worked example from analysis_access_and_reporting_design.md §5.3.
const SPEC_METRICS = metrics({
  healthScore: 72.4,
  criticalCount: 2,
  vulnerabilityCount: 5,
  duplicationPct: 8.1,
  complexityCount: 12,
  codeSmellCount: 47,
  debtMinutes: 380,
  debtDeltaMinutes: 45,
  gateResult: 'FAIL',
});

const SPEC_GATE = gate({
  minHealthScore: 60,
  maxCriticalFindings: 0,
  maxVulnerabilities: 3,
  maxDuplicationPct: 5,
  maxComplexityCount: 20,
  maxCodeSmellCount: 50,
});

// Body rows of the table whose header starts with the given text.
const tableRows = (body: string, header: string) => {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => line.startsWith(header));
  if (start === -1) return [];
  const end = lines.indexOf('', start);
  return lines.slice(start + 2, end === -1 ? undefined : end);
};

const metricTableRows = (body: string) => tableRows(body, '| Metric');

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
    const body = buildPrComment({ metrics: metrics(), findings: [], baseline: null, gate: null });
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
      gate: null,
    });

    expect(body).toContain('### Technical debt: 6h 20m (⚠ ▲ +45m since last analysis)');
  });

  it('marks decreased debt as good with a down arrow', () => {
    const body = buildPrComment({
      metrics: metrics({ debtMinutes: 200, debtDeltaMinutes: -15 }),
      findings: [finding()],
      baseline: { healthScore: 80 },
      gate: null,
    });

    expect(body).toContain('(✔ ▼ -15m since last analysis)');
  });

  it('reports unchanged debt when the delta is zero and a baseline exists', () => {
    const body = buildPrComment({
      metrics: metrics({ debtMinutes: 200, debtDeltaMinutes: 0 }),
      findings: [finding()],
      baseline: { healthScore: 80 },
      gate: null,
    });

    expect(body).toContain('(✔ no change since last analysis)');
  });

  it('shows the health score delta against the baseline in the heading', () => {
    const down = buildPrComment({
      metrics: metrics({ healthScore: 72.4 }),
      findings: [],
      baseline: { healthScore: 76.5 },
      gate: null,
    });
    expect(down).toContain('## CodeHealth — Health Score 72.4 ▼ 4.1');

    const up = buildPrComment({
      metrics: metrics({ healthScore: 80 }),
      findings: [],
      baseline: { healthScore: 76.5 },
      gate: null,
    });
    expect(up).toContain('## CodeHealth — Health Score 80 ▲ +3.5');

    const same = buildPrComment({
      metrics: metrics({ healthScore: 80 }),
      findings: [],
      baseline: { healthScore: 80 },
      gate: null,
    });
    expect(same).toContain('## CodeHealth — Health Score 80\n');
  });

  it('omits the heading arrow when there is no baseline', () => {
    const body = buildPrComment({
      metrics: metrics({ healthScore: 72.4 }),
      findings: [],
      baseline: null,
      gate: null,
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
      gate: null,
    });
    expect(failed).toContain('🟠 **Fair** · Quality gate: **FAILED**');

    const passed = buildPrComment({
      metrics: metrics({ healthScore: 95, gateResult: 'PASS' }),
      findings: [],
      baseline: null,
      gate: null,
    });
    expect(passed).toContain('🟢 **Excellent** · Quality gate: **PASSED**');

    const none = buildPrComment({ metrics: metrics(), findings: [], baseline: null, gate: null });
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
      gate: null,
    });

    expect(tableRows(body, '| Category')).toEqual([
      '| Vulnerabilities | 1 | 1h |',
      '| Complexity | 1 | 1h |',
      '| Code smells | 2 | 25m |',
    ]);
  });

  it('lists every finding count, with or without a gate', () => {
    const body = buildPrComment({
      metrics: metrics({
        criticalCount: 1,
        vulnerabilityCount: 17,
        duplicationPct: 3.46,
        codeSmellCount: 14,
      }),
      findings: [],
      baseline: null,
      gate: null,
    });

    expect(body).toContain('### Findings\n\n| Finding | Count |\n|---|---:|');
    expect(tableRows(body, '| Finding')).toEqual([
      '| Critical findings | 1 |',
      '| Vulnerabilities | 17 |',
      '| Duplication | 3.5% |',
      '| Complexity issues | 0 |',
      '| Code smells | 14 |',
    ]);
  });
});

describe('metricRows', () => {
  it('omits rows whose threshold is not configured', () => {
    const rows = metricRows(metrics({ vulnerabilityCount: 1 }), gate({ maxVulnerabilities: 3 }));

    expect(rows.map((row) => row.label)).toEqual(['Health Score', 'Vulnerabilities']);
  });

  it('sorts failing rows above passing rows, keeping the fixed order within each group', () => {
    const rows = metricRows(SPEC_METRICS, SPEC_GATE);

    expect(rows.map((row) => `${row.label}:${row.passed}`)).toEqual([
      'Critical findings:false',
      'Vulnerabilities:false',
      'Duplication:false',
      'Health Score:true',
      'Complexity issues:true',
      'Code smells:true',
    ]);
  });

  it('treats a value exactly at its limit as passing', () => {
    const atLimit = metricRows(
      metrics({ healthScore: 60, vulnerabilityCount: 3 }),
      gate({ minHealthScore: 60, maxVulnerabilities: 3 }),
    );
    expect(atLimit.every((row) => row.passed)).toBe(true);

    const overLimit = metricRows(
      metrics({ healthScore: 59.9, vulnerabilityCount: 4 }),
      gate({ minHealthScore: 60, maxVulnerabilities: 3 }),
    );
    expect(overLimit.every((row) => !row.passed)).toBe(true);
  });
});

describe('buildPrComment metrics table', () => {
  it('renders no metrics table when the repo has no quality gate', () => {
    const body = buildPrComment({
      metrics: metrics({ gateResult: 'FAIL' }),
      findings: [],
      baseline: null,
      gate: null,
    });

    expect(body).not.toContain('| Metric |');
    expect(body).not.toContain('Technical debt |');
    expect(body).toContain('Quality gate: **FAILED**\n');
  });

  it('renders the §5.3 example: failing rows first, debt trend last, breach count in the verdict', () => {
    const body = buildPrComment({
      metrics: SPEC_METRICS,
      findings: [],
      baseline: { healthScore: 76.5 },
      gate: SPEC_GATE,
    });

    expect(body).toContain('🟡 **Good** · Quality gate: **FAILED** — 3 of 6 metrics breached');
    expect(body).toContain('| Metric | Value | Target |  |\n|---|---:|---:|:-:|');
    expect(metricTableRows(body)).toEqual([
      '| Critical findings | 2 | ≤ 0 | ✘ |',
      '| Vulnerabilities | 5 | ≤ 3 | ✘ |',
      '| Duplication | 8.1% | ≤ 5% | ✘ |',
      '| Health Score | 72.4 | ≥ 60 | ✔ |',
      '| Complexity issues | 12 | ≤ 20 | ✔ |',
      '| Code smells | 47 | ≤ 50 | ✔ |',
      '| Technical debt | 6h 20m (▲ +45m) | no increase | ⚠ |',
    ]);
  });

  it('rounds duplication to one decimal but compares the raw value', () => {
    const body = buildPrComment({
      metrics: metrics({ duplicationPct: 5.04 }),
      findings: [],
      baseline: null,
      gate: gate({ maxDuplicationPct: 5 }),
    });

    expect(body).toContain('| Duplication | 5% | ≤ 5% | ✘ |');
  });

  it('adds the breach count only on FAIL and never counts the debt row', () => {
    const passed = buildPrComment({
      metrics: metrics({ healthScore: 95, debtDeltaMinutes: 45, gateResult: 'PASS' }),
      findings: [],
      baseline: { healthScore: 90 },
      gate: gate(),
    });
    expect(passed).toContain('Quality gate: **PASSED**\n');
    expect(passed).not.toContain('metrics breached');
    expect(passed).toContain('| Technical debt | 0m (▲ +45m) | no increase | ⚠ |');

    const failed = buildPrComment({
      metrics: metrics({ healthScore: 40, debtDeltaMinutes: 45, gateResult: 'FAIL' }),
      findings: [],
      baseline: { healthScore: 90 },
      gate: gate(),
    });
    expect(failed).toContain('Quality gate: **FAILED** — 1 of 1 metrics breached');
  });

  it('shows the debt trend next to the value, and drops the row on a first analysis', () => {
    const down = buildPrComment({
      metrics: metrics({ debtMinutes: 200, debtDeltaMinutes: -15 }),
      findings: [],
      baseline: { healthScore: 90 },
      gate: gate(),
    });
    expect(down).toContain('| Technical debt | 3h 20m (▼ -15m) | no increase | ✔ |');

    const held = buildPrComment({
      metrics: metrics({ debtMinutes: 200, debtDeltaMinutes: 0 }),
      findings: [],
      baseline: { healthScore: 90 },
      gate: gate(),
    });
    expect(held).toContain('| Technical debt | 3h 20m | no increase | ✔ |');

    const first = buildPrComment({
      metrics: metrics({ debtMinutes: 200 }),
      findings: [],
      baseline: null,
      gate: gate(),
    });
    expect(first).not.toContain('| Technical debt |');
  });

  it('keeps the debt-by-category table below the metrics table', () => {
    const body = buildPrComment({
      metrics: metrics({ debtMinutes: 60 }),
      findings: [finding({ category: 'VULNERABILITY', debtMinutes: 60 })],
      baseline: null,
      gate: gate(),
    });
    const lines = body.split('\n');

    expect(lines.indexOf('| Metric | Value | Target |  |')).toBeLessThan(
      lines.indexOf('### Technical debt: 1h (first analysis, no baseline)'),
    );
    expect(body).toContain('| Vulnerabilities | 1 | 1h |');
  });
});
