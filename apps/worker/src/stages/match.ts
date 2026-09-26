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
const lineDistance = (a: AnalysisFinding, b: AnalysisFinding, tolerance: number) => {
  if (a.line === null || b.line === null) return a.line === b.line ? 0 : Infinity;

  const distance = Math.abs(a.line - b.line);
  return distance <= tolerance ? distance : Infinity;
};

// Numbers in a message are often line refs or counts that shift with the code,
// like "also in b.ts:30-42", so they're left out of the comparison.
const messageText = (finding: AnalysisFinding) => finding.message.replace(/\d+/g, '#');

/**
 * Classifies findings as NEW, EXISTING, or RESOLVED against a baseline. Same
 * tool + file + rule with the same message counts as the same finding however
 * far it moved; failing that, within a few lines. Each baseline finding can only
 * be claimed once.
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

  // Claims the nearest unclaimed baseline finding, if there is one.
  const claim = (finding: AnalysisFinding, sameMessage: boolean) => {
    let best = -1;
    let bestDistance = Infinity;

    for (const index of pool.get(matchKey(finding)) ?? []) {
      if (claimed.has(index)) continue;
      if (sameMessage && messageText(baseline[index]) !== messageText(finding)) continue;

      const tolerance = sameMessage ? Infinity : LINE_MATCH_TOLERANCE;
      const distance = lineDistance(baseline[index], finding, tolerance);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }

    if (best !== -1) claimed.add(best);
    return best !== -1;
  };

  // Code added above a finding moves its line but not what it says, so the same
  // message goes first. The line fallback catches a message that was reworded.
  const sameMessage = findings.map((finding) => claim(finding, true));

  const matched = findings.map(
    (finding, i): AnalysisFinding => ({
      ...finding,
      state: sameMessage[i] || claim(finding, false) ? 'EXISTING' : 'NEW',
    }),
  );

  const resolved = baseline
    .filter((_, index) => !claimed.has(index))
    .map((finding): AnalysisFinding => ({ ...finding, state: 'RESOLVED' }));

  return { findings: matched, resolved };
}
