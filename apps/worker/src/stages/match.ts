import type { AnalysisFinding } from '@codehealth/shared';

// How far a finding may drift down a file and still count as the same one.
export const LINE_MATCH_TOLERANCE = 5;

export interface MatchInput {
  findings: AnalysisFinding[];
  // null on first run
  baseline: AnalysisFinding[] | null;
}

export interface MatchResult {
  findings: AnalysisFinding[];
  resolved: AnalysisFinding[];
}

const matchKey = (finding: AnalysisFinding) =>
  `${finding.tool}|${finding.file}|${finding.rule}`;

// Infinity = no match. two null lines count as equal
const lineDistance = (a: AnalysisFinding, b: AnalysisFinding, tolerance: number) => {
  if (a.line === null || b.line === null) return a.line === b.line ? 0 : Infinity;

  const distance = Math.abs(a.line - b.line);
  return distance <= tolerance ? distance : Infinity;
};

// ignore numbers, they shift when code moves
const messageText = (finding: AnalysisFinding) => finding.message.replace(/\d+/g, '#');

// marks findings NEW / EXISTING / RESOLVED against the last run
export function matchFindings({ findings, baseline }: MatchInput): MatchResult {
  if (!baseline) {
    return {
      findings: findings.map((finding): AnalysisFinding => ({ ...finding, state: 'NEW' })),
      resolved: [],
    };
  }

  const pool = new Map<string, number[]>();

  baseline.forEach((finding, index) => {
    const group = pool.get(matchKey(finding));
    if (group) group.push(index);
    else pool.set(matchKey(finding), [index]);
  });

  const claimed = new Set<number>();

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

  // match on message first, then fall back to line distance
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
