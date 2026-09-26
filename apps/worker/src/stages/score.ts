import type { AnalysisFinding, FindingCategory, Severity } from '@codehealth/shared';

// weight of each category
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
  debtMinutes: number;
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
  // so a score can be explained later
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

// 100 minus penalties, scaled for repo size. also sums debt minutes
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

  // group by rule for the repeat discount
  const byRule = new Map<string, AnalysisFinding[]>();

  let debtMinutes = 0;

  for (const finding of findings) {
    categoryCounts[finding.category]++;
    severityCounts[finding.severity]++;

    // debt counts every finding, jscpd ones too
    debtMinutes += finding.debtMinutes;

    // jscpd is already counted in the duplication percentage
    if (finding.category === 'DUPLICATION' && finding.tool === 'jscpd') continue;

    const key = `${finding.category}:${finding.rule}`;
    const group = byRule.get(key);
    if (group) group.push(finding);
    else byRule.set(key, [finding]);
  }

  let rawFindingPenalty = 0;

  for (const group of byRule.values()) {
    // worst first so it pays full price
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

  // per 1000 lines so big repos aren't punished for size
  const locScale =
    linesOfCode > LOC_NORMALIZATION_BASE ? LOC_NORMALIZATION_BASE / linesOfCode : 1;
  const findingPenalty = rawFindingPenalty * locScale;

  // duplication has its own penalty, not scaled
  const clampedDuplicationPct = Math.min(100, Math.max(0, duplicationPct));
  const duplicationPenalty =
    clampedDuplicationPct * DUPLICATION_PCT_MULTIPLIER * CATEGORY_WEIGHTS.DUPLICATION;

  const totalPenalty = findingPenalty + duplicationPenalty;

  return {
    healthScore: Math.max(0, round(100 - totalPenalty, 1)),
    debtMinutes,
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
