import type { AnalysisFinding } from '@codehealth/shared';

// How far a finding may drift down a file and still count as the same one.
export const LINE_MATCH_TOLERANCE = 5;

export interface MatchInput {
  findings: AnalysisFinding[];
  // Null on the first analysis of a repo: there is no previous snapshot to diff against.
  baseline: AnalysisFinding[] | null;
}

export interface MatchResult {
  // The same findings in the same order, with state filled in.
  findings: AnalysisFinding[];
  // Baseline findings this run no longer reports.
  resolved: AnalysisFinding[];
}

// Tool + file + rule have to match before line distance is even worth checking.
const matchKey = (finding: AnalysisFinding) =>
  `${finding.tool}|${finding.file}|${finding.rule}`;

// Infinity = not a match. Two null lines (e.g. radon's maintainability index)
// count as equal; a null against a real line never matches.
const lineDistance = (a: AnalysisFinding, b: AnalysisFinding) => {
  if (a.line === null || b.line === null) return a.line === b.line ? 0 : Infinity;

  const distance = Math.abs(a.line - b.line);
  return distance <= LINE_MATCH_TOLERANCE ? distance : Infinity;
};

/**
 * Classifies findings as NEW, EXISTING, or RESOLVED against a baseline. Same
 * tool + file + rule within a few lines counts as the same finding, and each
 * baseline finding can only be claimed once.
 *
 * Pure — same input, same classification, every time.
 */
export function matchFindings({ findings, baseline }: MatchInput): MatchResult {
  if (!baseline) {
    return {
      findings: findings.map((finding): AnalysisFinding => ({ ...finding, state: 'NEW' })),
      resolved: [],
    };
  }

  // Bucketed by key, so each finding only checks its own candidates.
  const pool = new Map<string, number[]>();

  baseline.forEach((finding, index) => {
    const group = pool.get(matchKey(finding));
    if (group) group.push(index);
    else pool.set(matchKey(finding), [index]);
  });

  const claimed = new Set<number>();

  const matched = findings.map((finding): AnalysisFinding => {
    let best = -1;
    let bestDistance = Infinity;

    for (const index of pool.get(matchKey(finding)) ?? []) {
      if (claimed.has(index)) continue;

      const distance = lineDistance(baseline[index], finding);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }

    if (best === -1) return { ...finding, state: 'NEW' };

    claimed.add(best);
    return { ...finding, state: 'EXISTING' };
  });

  const resolved = baseline
    .filter((_, index) => !claimed.has(index))
    .map((finding): AnalysisFinding => ({ ...finding, state: 'RESOLVED' }));

  return { findings: matched, resolved };
}
