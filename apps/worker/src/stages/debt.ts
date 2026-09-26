import type { AnalysisFinding } from '@codehealth/shared';

export interface DebtDeltaInput {
  currentDebtMinutes: number;
  // null = first run, [] = previous run was clean
  baseline: AnalysisFinding[] | null;
}

// positive = debt grew, 0 on first run
export function computeDebtDelta({ currentDebtMinutes, baseline }: DebtDeltaInput): number {
  if (!baseline) return 0;

  const baselineDebtMinutes = baseline.reduce((total, finding) => total + finding.debtMinutes, 0);

  return currentDebtMinutes - baselineDebtMinutes;
}
