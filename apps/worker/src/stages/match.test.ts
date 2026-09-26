import { describe, it, expect } from 'vitest';
import type { AnalysisFinding } from '@codehealth/shared';
import { matchFindings } from './match';

function finding(overrides: Partial<AnalysisFinding> = {}): AnalysisFinding {
  return {
    file: 'src/foo.ts',
    line: 1,
    endLine: 1,
    column: null,
    endColumn: null,
    severity: 'MEDIUM',
    category: 'CODE_SMELL',
    state: 'UNKNOWN',
    rule: 'some-rule',
    message: 'issue',
    tool: 'eslint',
    debtMinutes: 5,
    ...overrides,
  };
}

const states = (findings: AnalysisFinding[]) => findings.map((f) => f.state);

describe('matchFindings', () => {
  it('marks everything new when there is no baseline', () => {
    const result = matchFindings({
      findings: [finding(), finding({ rule: 'other-rule' })],
      baseline: null,
    });

    expect(states(result.findings)).toEqual(['NEW', 'NEW']);
    expect(result.resolved).toEqual([]);
  });

  it('resolves every baseline finding when this run reports nothing', () => {
    const result = matchFindings({
      findings: [],
      baseline: [finding(), finding({ rule: 'other-rule' })],
    });

    expect(result.findings).toEqual([]);
    expect(states(result.resolved)).toEqual(['RESOLVED', 'RESOLVED']);
  });

  it('carries over a finding that has not moved', () => {
    const result = matchFindings({
      findings: [finding({ line: 42 })],
      baseline: [finding({ line: 42 })],
    });

    expect(states(result.findings)).toEqual(['EXISTING']);
    expect(result.resolved).toEqual([]);
  });

  it('carries over a finding that drifted within the tolerance', () => {
    const result = matchFindings({
      findings: [finding({ line: 47 })],
      baseline: [finding({ line: 42 })],
    });

    expect(states(result.findings)).toEqual(['EXISTING']);
    expect(result.resolved).toEqual([]);
  });

  it('treats a finding that moved far and says something else as new, and resolves the old one', () => {
    const result = matchFindings({
      findings: [finding({ line: 242, message: "'b' is never used" })],
      baseline: [finding({ line: 42, message: "'a' is never used" })],
    });

    expect(states(result.findings)).toEqual(['NEW']);
    expect(states(result.resolved)).toEqual(['RESOLVED']);
    expect(result.resolved[0].line).toBe(42);
  });

  it('follows a finding with the same message however far code above it pushed it', () => {
    const result = matchFindings({
      findings: [finding({ line: 40, message: "'a' is never used" })],
      baseline: [finding({ line: 10, message: "'a' is never used" })],
    });

    expect(states(result.findings)).toEqual(['EXISTING']);
    expect(result.resolved).toEqual([]);
  });

  it('ignores line numbers inside the message when following a moved finding', () => {
    const result = matchFindings({
      findings: [finding({ line: 43, message: '13 duplicated lines, also in b.ts:60-72' })],
      baseline: [finding({ line: 13, message: '13 duplicated lines, also in b.ts:30-42' })],
    });

    expect(states(result.findings)).toEqual(['EXISTING']);
  });

  it('still matches nearby when the message carries a number that changed', () => {
    const result = matchFindings({
      findings: [finding({ line: 12, message: 'complexity of 14' })],
      baseline: [finding({ line: 10, message: 'complexity of 12' })],
    });

    expect(states(result.findings)).toEqual(['EXISTING']);
  });

  it('prefers the same message over a closer different one', () => {
    const result = matchFindings({
      findings: [finding({ line: 40, message: "'a' is never used" })],
      baseline: [
        finding({ line: 41, message: "'b' is never used" }),
        finding({ line: 10, message: "'a' is never used" }),
      ],
    });

    expect(states(result.findings)).toEqual(['EXISTING']);
    expect(result.resolved.map((f) => f.message)).toEqual(["'b' is never used"]);
  });

  it('claims the closest baseline finding when more than one is in range', () => {
    const result = matchFindings({
      findings: [finding({ line: 44 })],
      baseline: [finding({ line: 40 }), finding({ line: 43 })],
    });

    expect(states(result.findings)).toEqual(['EXISTING']);
    // The nearer one was claimed, so the far one is what's left over.
    expect(result.resolved.map((f) => f.line)).toEqual([40]);
  });

  it('lets one baseline finding satisfy only one current finding', () => {
    const result = matchFindings({
      findings: [finding({ line: 42 }), finding({ line: 43 })],
      baseline: [finding({ line: 42 })],
    });

    expect(states(result.findings)).toEqual(['EXISTING', 'NEW']);
    expect(result.resolved).toEqual([]);
  });

  it('does not match across a different file, rule, or tool', () => {
    const differentFile = matchFindings({
      findings: [finding({ file: 'src/bar.ts' })],
      baseline: [finding({ file: 'src/foo.ts' })],
    });
    const differentRule = matchFindings({
      findings: [finding({ rule: 'no-console' })],
      baseline: [finding({ rule: 'no-var' })],
    });
    // Same rule name from two tools is not the same finding.
    const differentTool = matchFindings({
      findings: [finding({ rule: 'complexity', tool: 'pylint' })],
      baseline: [finding({ rule: 'complexity', tool: 'eslint' })],
    });

    for (const result of [differentFile, differentRule, differentTool]) {
      expect(states(result.findings)).toEqual(['NEW']);
      expect(states(result.resolved)).toEqual(['RESOLVED']);
    }
  });

  it('carries over file-level findings that have no line at all', () => {
    // radon's maintainability index has a file but no line.
    const withoutLine = () =>
      finding({ line: null, endLine: null, rule: 'maintainability-index', tool: 'radon' });

    const result = matchFindings({ findings: [withoutLine()], baseline: [withoutLine()] });

    expect(states(result.findings)).toEqual(['EXISTING']);
    expect(result.resolved).toEqual([]);
  });

  it('does not match a finding without a line against one with a line', () => {
    const result = matchFindings({
      findings: [finding({ line: null })],
      baseline: [finding({ line: 3 })],
    });

    expect(states(result.findings)).toEqual(['NEW']);
    expect(states(result.resolved)).toEqual(['RESOLVED']);
  });

  it('classifies the worked example from the scoring spec', () => {
    const result = matchFindings({
      findings: [
        // Shifted two lines, so still the same finding.
        finding({ file: 'src/auth.ts', line: 12, rule: 'B101', tool: 'bandit' }),
        finding({ file: 'src/new.ts', line: 30, rule: 'xss', tool: 'bandit' }),
      ],
      baseline: [
        finding({ file: 'src/auth.ts', line: 10, rule: 'B101', tool: 'bandit' }),
        finding({ file: 'src/utils.ts', line: 20, rule: 'no-var' }),
        finding({ file: 'src/old.ts', line: 5, rule: 'complexity' }),
      ],
    });

    expect(states(result.findings)).toEqual(['EXISTING', 'NEW']);
    expect(result.resolved.map((f) => f.file)).toEqual(['src/utils.ts', 'src/old.ts']);
  });

  it('keeps the input order and leaves the input findings untouched', () => {
    const findings = [
      finding({ rule: 'a', line: 1 }),
      finding({ rule: 'b', line: 2 }),
      finding({ rule: 'c', line: 3 }),
    ];
    const baseline = [finding({ rule: 'b', line: 2 })];

    const result = matchFindings({ findings, baseline });

    expect(result.findings.map((f) => f.rule)).toEqual(['a', 'b', 'c']);
    expect(states(result.findings)).toEqual(['NEW', 'EXISTING', 'NEW']);
    expect(states(findings)).toEqual(['UNKNOWN', 'UNKNOWN', 'UNKNOWN']);
    expect(baseline[0].state).toBe('UNKNOWN');
  });
});
