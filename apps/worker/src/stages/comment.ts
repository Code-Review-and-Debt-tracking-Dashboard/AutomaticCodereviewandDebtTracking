import type { AnalysisFinding, FindingCategory, SnapshotMetrics } from '@codehealth/shared';

// Lets the poster find its own comment on a PR if botCommentId is ever lost.
export const COMMENT_MARKER = '<!-- codehealth-bot -->';

export interface CommentInput {
  metrics: SnapshotMetrics;
  findings: AnalysisFinding[];
  // Null on the first analysis of a repo: there is no previous snapshot to diff against.
  baseline: { healthScore: number } | null;
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

/**
 * Renders the PR comment body from the numbers that go on the health snapshot.
 * Everything is read from the metrics rather than recomputed, so the comment
 * can never disagree with what the dashboard shows for the same run.
 */
export function buildPrComment({ metrics, findings, baseline }: CommentInput): string {
  const band = scoreBand(metrics.healthScore);

  const statusParts = [`${band.emoji} **${band.label}**`];
  if (metrics.gateResult) {
    statusParts.push(`Quality gate: **${metrics.gateResult === 'PASS' ? 'PASSED' : 'FAILED'}**`);
  }

  const lines = [
    COMMENT_MARKER,
    healthScoreHeading(metrics.healthScore, baseline),
    '',
    statusParts.join(' · '),
    '',
    `### Technical debt: ${formatMinutes(metrics.debtMinutes)} (${debtDeltaText(metrics.debtDeltaMinutes, baseline)})`,
    '',
    ...debtTable(findings),
  ];

  return lines.join('\n') + '\n';
}
