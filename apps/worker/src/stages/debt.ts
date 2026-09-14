import type { AnalysisFinding } from '@codehealth/shared';

export interface DebtDeltaInput {
  currentDebtMinutes: number;
  // Null on the first analysis of a repo: nothing to compare against. An empty
  // array is different — that's a previous snapshot that happened to be clean.
  baseline: AnalysisFinding[] | null;
}

/**
 * Remediation minutes this run added or removed against the baseline. Positive
 * means debt grew, negative means it shrank, zero on a first analysis.
 *
 * Takes the baseline as an argument rather than reading the previous snapshot,
 * same as the matcher, so the stage stays pure and the worker needs no database.
 */
export function computeDebtDelta({ currentDebtMinutes, baseline }: DebtDeltaInput): number {
  if (!baseline) return 0;

  const baselineDebtMinutes = baseline.reduce((total, finding) => total + finding.debtMinutes, 0);

  return currentDebtMinutes - baselineDebtMinutes;
}
