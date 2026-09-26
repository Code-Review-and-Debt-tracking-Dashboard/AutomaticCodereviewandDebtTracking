import { describe, it, expect } from 'vitest';
import type { AnalysisFinding } from '@codehealth/shared';
import { computeDebtDelta } from './debt';

function finding(debtMinutes: number): AnalysisFinding {
  return {
    file: 'src/foo.ts',
    line: 1,
    endLine: 1,
    column: null,
    endColumn: null,
    severity: 'MEDIUM',
    category: 'CODE_SMELL',
    state: 'EXISTING',
    rule: 'some-rule',
    message: 'issue',
    tool: 'eslint',
    debtMinutes,
  };
}

describe('computeDebtDelta', () => {
  it('is zero on a first analysis, however much debt this run found', () => {
    expect(computeDebtDelta({ currentDebtMinutes: 240, baseline: null })).toBe(0);
  });

  it('charges the whole current debt when the previous snapshot was clean', () => {
    expect(computeDebtDelta({ currentDebtMinutes: 240, baseline: [] })).toBe(240);
  });

  it('is positive when debt grew', () => {
    expect(
      computeDebtDelta({ currentDebtMinutes: 145, baseline: [finding(60), finding(40)] }),
    ).toBe(45);
  });

  it('is negative when debt fell', () => {
    expect(
      computeDebtDelta({ currentDebtMinutes: 85, baseline: [finding(60), finding(40)] }),
    ).toBe(-15);
  });

  it('is zero when debt held steady', () => {
    expect(
      computeDebtDelta({ currentDebtMinutes: 100, baseline: [finding(60), finding(40)] }),
    ).toBe(0);
  });
});
