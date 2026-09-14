import type {
  AnalysisFinding,
  FindingCategory,
  QualityGateThresholds,
  SnapshotMetrics,
} from '@codehealth/shared';

// Lets the poster find its own comment on a PR if botCommentId is ever lost.
export const COMMENT_MARKER = '<!-- codehealth-bot -->';

export interface CommentInput {
  metrics: SnapshotMetrics;
  findings: AnalysisFinding[];
  // Null on the first analysis of a repo: there is no previous snapshot to diff against.
  baseline: { healthScore: number } | null;
  // Null when the repo has no quality gate configured (mirrors metrics.gateResult).
  gate: QualityGateThresholds | null;
}

interface ScoreBand {
  label: string;
  emoji: string;
}

// Bands from scoring_algorithm.md §7. Same cut-offs the dashboard colours by.
export function scoreBand(score: number): ScoreBand {
  if (score >= 90) return { label: 'Excellent', emoji: '🟢' };
  if (score >= 70) return { label: 'Good', emoji: '🟡' };
  if (score >= 50) return { label: 'Fair', emoji: '🟠' };
  if (score >= 25) return { label: 'Poor', emoji: '🔴' };
  return { label: 'Critical', emoji: '⚫' };
}

export function formatMinutes(minutes: number): string {
  const total = Math.round(Math.abs(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

const CATEGORY_ORDER: FindingCategory[] = [
  'VULNERABILITY',
  'COMPLEXITY',
  'DUPLICATION',
  'CODE_SMELL',
  'MAINTAINABILITY',
];

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  VULNERABILITY: 'Vulnerabilities',
  COMPLEXITY: 'Complexity',
  DUPLICATION: 'Duplication',
  CODE_SMELL: 'Code smells',
  MAINTAINABILITY: 'Maintainability',
};

export function debtByCategory(
  findings: AnalysisFinding[],
): Record<FindingCategory, { count: number; minutes: number }> {
  const totals = {
    VULNERABILITY: { count: 0, minutes: 0 },
    COMPLEXITY: { count: 0, minutes: 0 },
    DUPLICATION: { count: 0, minutes: 0 },
    CODE_SMELL: { count: 0, minutes: 0 },
    MAINTAINABILITY: { count: 0, minutes: 0 },
  };

  for (const finding of findings) {
    totals[finding.category].count++;
    totals[finding.category].minutes += finding.debtMinutes;
  }

  return totals;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function healthScoreHeading(score: number, baseline: CommentInput['baseline']): string {
  let heading = `## CodeHealth — Health Score ${score}`;
  if (baseline) {
    const delta = round1(score - baseline.healthScore);
    if (delta > 0) heading += ` ▲ +${delta}`;
    else if (delta < 0) heading += ` ▼ ${Math.abs(delta)}`;
  }
  return heading;
}

function debtDeltaText(deltaMinutes: number, baseline: CommentInput['baseline']): string {
  if (!baseline) return 'first analysis, no baseline';
  if (deltaMinutes > 0) return `⚠️ ▲ +${formatMinutes(deltaMinutes)} since last analysis`;
  if (deltaMinutes < 0) return `✅ ▼ -${formatMinutes(deltaMinutes)} since last analysis`;
  return '✅ no change since last analysis';
}

function debtTable(findings: AnalysisFinding[]): string[] {
  if (findings.length === 0) return ['No findings — nothing to remediate.'];

  const totals = debtByCategory(findings);
  const rows = CATEGORY_ORDER.filter((category) => totals[category].count > 0).map(
    (category) =>
      `| ${CATEGORY_LABELS[category]} | ${totals[category].count} | ${formatMinutes(totals[category].minutes)} |`,
  );

  return ['| Category | Findings | Debt |', '|---|---:|---:|', ...rows];
}

export interface MetricRow {
  label: string;
  value: string;
  threshold: string;
  passed: boolean;
}

const percent = (value: number) => `${round1(value)}%`;

function maxRow(
  label: string,
  value: number,
  max: number | null,
  format: (n: number) => string = String,
): MetricRow | null {
  if (max === null) return null;
  return { label, value: format(value), threshold: `≤ ${format(max)}`, passed: value <= max };
}

/**
 * One row per configured threshold, failing rows first so the reason a gate
 * failed is the first thing read. Within each group the order is fixed, so
 * two runs with the same breaches render identically.
 */
export function metricRows(metrics: SnapshotMetrics, gate: QualityGateThresholds): MetricRow[] {
  const candidates: Array<MetricRow | null> = [
    {
      label: 'Health Score',
      value: String(metrics.healthScore),
      threshold: `≥ ${gate.minHealthScore}`,
      passed: metrics.healthScore >= gate.minHealthScore,
    },
    maxRow('Critical findings', metrics.criticalCount, gate.maxCriticalFindings),
    maxRow('Vulnerabilities', metrics.vulnerabilityCount, gate.maxVulnerabilities),
    maxRow('Duplication', metrics.duplicationPct, gate.maxDuplicationPct, percent),
    maxRow('Complexity issues', metrics.complexityCount, gate.maxComplexityCount),
    maxRow('Code smells', metrics.codeSmellCount, gate.maxCodeSmellCount),
  ];

  const rows = candidates.filter((row): row is MetricRow => row !== null);
  return [...rows.filter((row) => !row.passed), ...rows.filter((row) => row.passed)];
}

// Debt has no threshold on QualityGate, so it is a trend indicator only and
// never counts towards the breached total.
function debtRow(metrics: SnapshotMetrics, baseline: CommentInput['baseline']): string {
  const value = formatMinutes(metrics.debtMinutes);
  if (!baseline) return `| Technical debt | ${value} | — | — |`;

  const delta = metrics.debtDeltaMinutes;
  let trend = '—';
  if (delta > 0) trend = `▲ +${formatMinutes(delta)}`;
  else if (delta < 0) trend = `▼ -${formatMinutes(delta)}`;

  return `| Technical debt | ${value} | ${trend} | ${delta > 0 ? '⚠️' : '✅'} |`;
}

function metricsTable(
  rows: MetricRow[],
  metrics: SnapshotMetrics,
  baseline: CommentInput['baseline'],
): string[] {
  return [
    '| Metric | Value | Threshold |  |',
    '|---|---:|---:|:-:|',
    ...rows.map(
      (row) => `| ${row.label} | ${row.value} | ${row.threshold} | ${row.passed ? '✅' : '❌'} |`,
    ),
    debtRow(metrics, baseline),
  ];
}

/**
 * Renders the PR comment body from the numbers that go on the health snapshot.
 * Everything is read from the metrics rather than recomputed, so the comment
 * can never disagree with what the dashboard shows for the same run.
 */
export function buildPrComment({ metrics, findings, baseline, gate }: CommentInput): string {
  const band = scoreBand(metrics.healthScore);
  const rows = gate ? metricRows(metrics, gate) : [];

  const statusParts = [`${band.emoji} **${band.label}**`];
  if (metrics.gateResult) {
    let verdict = `Quality gate: **${metrics.gateResult === 'PASS' ? 'PASSED' : 'FAILED'}**`;
    // The verdict restates the stored gateResult; the count only explains it.
    if (gate && metrics.gateResult === 'FAIL') {
      const breached = rows.filter((row) => !row.passed).length;
      verdict += ` — ${breached} of ${rows.length} metrics breached`;
    }
    statusParts.push(verdict);
  }

  const lines = [
    COMMENT_MARKER,
    healthScoreHeading(metrics.healthScore, baseline),
    '',
    statusParts.join(' · '),
    '',
    ...(gate ? [...metricsTable(rows, metrics, baseline), ''] : []),
    `### Technical debt: ${formatMinutes(metrics.debtMinutes)} (${debtDeltaText(metrics.debtDeltaMinutes, baseline)})`,
    '',
    ...debtTable(findings),
  ];

  return lines.join('\n') + '\n';
}
