import type { AnalysisFinding, FindingCategory, Severity } from '@codehealth/shared';

// How much each category costs relative to the others. Security is four times a
// style issue. Exported because the gate and the PR comment show these numbers.
export const CATEGORY_WEIGHTS: Record<FindingCategory, number> = {
  VULNERABILITY: 4.0,
  COMPLEXITY: 2.0,
  DUPLICATION: 1.5,
  MAINTAINABILITY: 1.5,
  CODE_SMELL: 1.0,
};

export const SEVERITY_MULTIPLIERS: Record<Severity, number> = {
  CRITICAL: 3.0,
  HIGH: 2.0,
  MEDIUM: 1.0,
  LOW: 0.5,
  INFO: 0.25,
};

const BASE_PENALTY = 0.5;
const DIMINISHING_COEFF = 0.3;
const DUPLICATION_PCT_MULTIPLIER = 0.3;
const LOC_NORMALIZATION_BASE = 1000;

export interface ScoreInput {
  findings: AnalysisFinding[];
  duplicationPct: number;
  linesOfCode: number;
}

export interface ScoreResult {
  healthScore: number;
  totalIssues: number;
  vulnerabilityCount: number;
  complexityCount: number;
  duplicationCount: number;
  codeSmellCount: number;
  maintainabilityCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  duplicationPct: number;
  // Kept so a score can be explained after the fact, rather than just asserted.
  penaltyBreakdown: {
    findingPenalty: number;
    duplicationPenalty: number;
    totalPenalty: number;
  };
}

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * Turns findings into a 0-100 health score. Start at 100 and deduct: each finding
 * costs its category weight times its severity, repeats of the same rule cost
 * less each time, and the whole lot is scaled down for big repos so a large
 * codebase isn't punished just for being large.
 *
 * Pure — same input, same score, every time. Nothing here touches the network or
 * the database, which is what lets an old score be recomputed and checked.
 */
export function computeScore({ findings, duplicationPct, linesOfCode }: ScoreInput): ScoreResult {
  const categoryCounts: Record<FindingCategory, number> = {
    VULNERABILITY: 0,
    COMPLEXITY: 0,
    DUPLICATION: 0,
    CODE_SMELL: 0,
    MAINTAINABILITY: 0,
  };

  const severityCounts: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  // Findings of the same rule, grouped, because the discount for a repeat only
  // makes sense against the others of its own rule.
  const byRule = new Map<string, AnalysisFinding[]>();

  for (const finding of findings) {
    categoryCounts[finding.category]++;
    severityCounts[finding.severity]++;

    // jscpd reports the same duplication twice: once as a clone pair, once in the
    // repo percentage below. Charging both would double it.
    if (finding.category === 'DUPLICATION' && finding.tool === 'jscpd') continue;

    const key = `${finding.category}:${finding.rule}`;
    const group = byRule.get(key);
    if (group) group.push(finding);
    else byRule.set(key, [finding]);
  }

  let rawFindingPenalty = 0;

  for (const group of byRule.values()) {
    // Worst one first, so it's the one that pays full price. Left in tool order a
    // critical finding could get discounted for no better reason than sitting
    // further down the file than a low one.
    group.sort((a, b) => SEVERITY_MULTIPLIERS[b.severity] - SEVERITY_MULTIPLIERS[a.severity]);

    group.forEach((finding, repeat) => {
      const diminishing = 1 / (1 + DIMINISHING_COEFF * repeat);

      rawFindingPenalty +=
        BASE_PENALTY *
        CATEGORY_WEIGHTS[finding.category] *
        SEVERITY_MULTIPLIERS[finding.severity] *
        diminishing;
    });
  }

  // Findings per 1000 lines rather than raw counts, so repos of different sizes
  // are comparable. Small repos are left alone.
  const locScale =
    linesOfCode > LOC_NORMALIZATION_BASE ? LOC_NORMALIZATION_BASE / linesOfCode : 1;
  const findingPenalty = rawFindingPenalty * locScale;

  // Duplication is a percentage of the repo, not a list of places, so it gets its
  // own penalty and is not scaled by size.
  const clampedDuplicationPct = Math.min(100, Math.max(0, duplicationPct));
  const duplicationPenalty =
    clampedDuplicationPct * DUPLICATION_PCT_MULTIPLIER * CATEGORY_WEIGHTS.DUPLICATION;

  const totalPenalty = findingPenalty + duplicationPenalty;

  return {
    healthScore: Math.max(0, round(100 - totalPenalty, 1)),
    totalIssues: findings.length,
    vulnerabilityCount: categoryCounts.VULNERABILITY,
    complexityCount: categoryCounts.COMPLEXITY,
    duplicationCount: categoryCounts.DUPLICATION,
    codeSmellCount: categoryCounts.CODE_SMELL,
    maintainabilityCount: categoryCounts.MAINTAINABILITY,
    criticalCount: severityCounts.CRITICAL,
    highCount: severityCounts.HIGH,
    mediumCount: severityCounts.MEDIUM,
    lowCount: severityCounts.LOW,
    duplicationPct: clampedDuplicationPct,
    penaltyBreakdown: {
      findingPenalty: round(findingPenalty, 2),
      duplicationPenalty: round(duplicationPenalty, 2),
      totalPenalty: round(totalPenalty, 2),
    },
  };
}
