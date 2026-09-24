import { describe, expect, it } from 'vitest';

import type { BanditLevel, BanditReport, BanditResult } from '../analyzers/bandit';
import type {
  CheckstyleLevel,
  CheckstyleReport,
  CheckstyleViolation,
} from '../analyzers/checkstyle';
import type { EslintMessage, EslintReport } from '../analyzers/eslint';
import type { JscpdClone, JscpdReport } from '../analyzers/jscpd';
import type { PmdPriority, PmdReport, PmdViolation } from '../analyzers/pmd';
import type { PylintMessage, PylintMessageType, PylintReport } from '../analyzers/pylint';
import type { RadonBlock, RadonFileMi, RadonRank, RadonReport } from '../analyzers/radon';
import type { TodoScanReport } from '../analyzers/todoScan';
import {
  type AnalyzerReports,
  DEBT_COST_TABLE,
  fromBandit,
  fromCheckstyle,
  fromEslint,
  fromJscpd,
  fromPmd,
  fromPylint,
  fromRadon,
  fromTodoScan,
  normalize,
} from './normalize';

const report: TodoScanReport = {
  matches: [
    { file: 'src/a.ts', line: 3, marker: 'TODO', text: 'tidy this' },
    { file: 'src/a.ts', line: 9, marker: 'FIXME', text: 'breaks on empty input' },
    { file: 'src/b.py', line: 1, marker: 'HACK', text: '' },
    { file: 'src/c.java', line: 7, marker: 'XXX', text: 'why?' },
  ],
  counts: { TODO: 1, FIXME: 1, HACK: 1, XXX: 1 },
};

describe('fromTodoScan', () => {
  it('maps every marker to a maintainability finding', () => {
    const findings = fromTodoScan(report);

    expect(findings).toHaveLength(4);
    for (const finding of findings) {
      expect(finding.category).toBe('MAINTAINABILITY');
      expect(finding.tool).toBe('todo-scan');
      expect(finding.state).toBe('UNKNOWN');
      expect(finding.endLine).toBe(finding.line);
    }
  });

  it('charges FIXME and HACK more than TODO and XXX', () => {
    const bySeverity = Object.fromEntries(
      fromTodoScan(report).map((f) => [f.rule, [f.severity, f.debtMinutes]]),
    );

    expect(bySeverity).toEqual({
      todo: ['LOW', 5],
      fixme: ['MEDIUM', 10],
      hack: ['MEDIUM', 10],
      xxx: ['LOW', 5],
    });
  });

  it('puts the note in the message and falls back to the bare marker', () => {
    const messages = fromTodoScan(report).map((f) => f.message);

    expect(messages).toEqual(['TODO: tidy this', 'FIXME: breaks on empty input', 'HACK', 'XXX: why?']);
  });

  it('is picked up by normalize', () => {
    const { findings } = normalize({ todoScan: report });

    expect(findings.map((f) => `${f.file}:${f.line}`)).toEqual([
      'src/a.ts:3',
      'src/a.ts:9',
      'src/b.py:1',
      'src/c.java:7',
    ]);
  });
});

// ── small builders so each test only spells out the fields it checks ──

const lint = (
  ruleId: string | null,
  severity: 1 | 2 = 2,
  extra: Partial<EslintMessage> = {},
): EslintMessage => ({ ruleId, severity, message: 'msg', line: 1, column: 1, ...extra });

const eslintReport = (messages: EslintMessage[]): EslintReport => ({
  results: [{ filePath: 'src/app.ts', messages }],
  errorCount: 0,
  warningCount: 0,
});

const pylintMessage = (type: PylintMessageType, symbol: string): PylintMessage => ({
  type,
  symbol,
  module: 'app',
  obj: '',
  line: 4,
  column: 0,
  endLine: 6,
  endColumn: 2,
  path: 'app.py',
  message: 'msg',
  'message-id': 'X0000',
});

const pylintReport = (messages: PylintMessage[]): PylintReport => ({
  messages,
  counts: { fatal: 0, error: 0, warning: 0, refactor: 0, convention: 0, information: 0 },
});

const banditResult = (
  severity: BanditLevel,
  confidence: BanditLevel,
  extra: Partial<BanditResult> = {},
): BanditResult => ({
  filename: 'app.py',
  line_number: 10,
  line_range: [10, 11, 12],
  col_offset: 4,
  end_col_offset: 20,
  test_id: 'B602',
  test_name: 'subprocess_popen_with_shell_equals_true',
  issue_severity: severity,
  issue_confidence: confidence,
  issue_text: 'shell=True',
  issue_cwe: null,
  more_info: '',
  code: '',
  ...extra,
});

const banditReport = (results: BanditResult[]): BanditReport => ({
  results,
  errors: [],
  counts: { LOW: 0, MEDIUM: 0, HIGH: 0, UNDEFINED: 0 },
  nosec: 0,
});

const radonBlock = (rank: RadonRank, extra: Partial<RadonBlock> = {}): RadonBlock => ({
  file: 'app.py',
  type: 'function',
  name: 'handle',
  classname: null,
  complexity: 12,
  rank,
  lineno: 5,
  endline: 40,
  col_offset: 0,
  ...extra,
});

const radonReport = (blocks: RadonBlock[], maintainability: RadonFileMi[] = []): RadonReport => ({
  blocks,
  maintainability,
  errors: [],
  counts: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
  miCounts: { A: 0, B: 0, C: 0 },
});

const violation = (level: CheckstyleLevel, rule: string): CheckstyleViolation => ({
  file: 'src/App.java',
  line: 12,
  column: 5,
  level,
  rule,
  message: 'msg',
});

const checkstyleReport = (violations: CheckstyleViolation[]): CheckstyleReport => ({
  violations,
  errors: [],
  counts: { error: 0, warning: 0, note: 0 },
});

const pmdViolation = (
  priority: PmdPriority,
  rule: string,
  ruleSet = 'Error Prone',
): PmdViolation => ({
  file: 'src/App.java',
  line: 20,
  endLine: 24,
  column: 9,
  endColumn: 30,
  rule,
  ruleSet,
  priority,
  message: 'msg',
});

const pmdReport = (violations: PmdViolation[]): PmdReport => ({
  violations,
  errors: [],
  counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
});

const clone = (lines: number): JscpdClone => ({
  format: 'typescript',
  lines,
  tokens: lines * 10,
  firstFile: { name: 'src/a.ts', start: 1, end: lines },
  secondFile: { name: 'src/b.ts', start: 50, end: 49 + lines },
});

const jscpdReport = (duplicates: JscpdClone[], percentage = 0): JscpdReport => ({
  duplicates,
  totalLines: 1000,
  duplicatedLines: 0,
  percentage,
});

describe('fromEslint', () => {
  it('skips parse errors and messages without a rule', () => {
    const findings = fromEslint(
      eslintReport([lint(null, 2, { fatal: true }), lint(null), lint('no-console')]),
    );

    expect(findings.map((f) => f.rule)).toEqual(['no-console']);
  });

  it('makes every security rule a high vulnerability, whatever its level', () => {
    const findings = fromEslint(
      eslintReport([
        lint('security/detect-eval-with-expression', 1),
        lint('sonarjs/no-hardcoded-passwords', 2),
        lint('sonarjs/pseudo-random', 1),
      ]),
    );

    for (const finding of findings) {
      expect([finding.category, finding.severity]).toEqual(['VULNERABILITY', 'HIGH']);
    }
    expect(findings).toHaveLength(3);
  });

  it('puts complexity and duplication rules in their own categories', () => {
    const findings = fromEslint(
      eslintReport([
        lint('complexity'),
        lint('sonarjs/cognitive-complexity'),
        lint('sonarjs/no-identical-functions'),
      ]),
    );

    expect(findings.map((f) => f.category)).toEqual(['COMPLEXITY', 'COMPLEXITY', 'DUPLICATION']);
  });

  it('calls anything else a code smell, graded by the eslint level', () => {
    const findings = fromEslint(eslintReport([lint('no-console', 2), lint('eqeqeq', 1)]));

    expect(findings.map((f) => [f.category, f.severity])).toEqual([
      ['CODE_SMELL', 'HIGH'],
      ['CODE_SMELL', 'MEDIUM'],
    ]);
  });

  it('turns missing positions into null', () => {
    const [finding] = fromEslint(
      eslintReport([{ ruleId: 'semi', severity: 1, message: 'Missing semicolon.' }]),
    );

    expect(finding).toMatchObject({
      file: 'src/app.ts',
      line: null,
      endLine: null,
      column: null,
      endColumn: null,
      message: 'Missing semicolon.',
      tool: 'eslint',
    });
  });
});

describe('fromPylint', () => {
  it('grades by message type', () => {
    const types: PylintMessageType[] = [
      'fatal',
      'error',
      'warning',
      'refactor',
      'convention',
      'information',
    ];
    const findings = fromPylint(pylintReport(types.map((t) => pylintMessage(t, 'x'))));

    expect(findings.map((f) => f.severity)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'LOW', 'INFO']);
  });

  it('categorises by symbol and uses it as the rule', () => {
    const findings = fromPylint(
      pylintReport([
        pylintMessage('refactor', 'too-many-branches'),
        pylintMessage('refactor', 'duplicate-code'),
        pylintMessage('warning', 'unused-import'),
      ]),
    );

    expect(findings.map((f) => [f.rule, f.category])).toEqual([
      ['too-many-branches', 'COMPLEXITY'],
      ['duplicate-code', 'DUPLICATION'],
      ['unused-import', 'CODE_SMELL'],
    ]);
  });

  it('keeps the positions pylint gives', () => {
    const [finding] = fromPylint(pylintReport([pylintMessage('warning', 'unused-import')]));

    expect(finding).toMatchObject({
      file: 'app.py',
      line: 4,
      endLine: 6,
      column: 0,
      endColumn: 2,
      tool: 'pylint',
    });
  });
});

describe('fromBandit', () => {
  it('only reaches critical when bandit is sure about a high issue', () => {
    const findings = fromBandit(
      banditReport([
        banditResult('HIGH', 'HIGH'),
        banditResult('HIGH', 'MEDIUM'),
        banditResult('MEDIUM', 'HIGH'),
        banditResult('LOW', 'HIGH'),
        banditResult('UNDEFINED', 'UNDEFINED'),
      ]),
    );

    expect(findings.map((f) => f.severity)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
  });

  it('files everything as a vulnerability under its test id', () => {
    const [finding] = fromBandit(banditReport([banditResult('LOW', 'LOW')]));

    expect(finding).toMatchObject({
      file: 'app.py',
      line: 10,
      column: 4,
      endColumn: 20,
      category: 'VULNERABILITY',
      rule: 'B602',
      message: 'shell=True',
      tool: 'bandit',
    });
  });

  it('ends at the last line of the range, or the start line if there is none', () => {
    const findings = fromBandit(
      banditReport([banditResult('LOW', 'LOW'), banditResult('LOW', 'LOW', { line_range: [] })]),
    );

    expect(findings.map((f) => f.endLine)).toEqual([12, 10]);
  });
});

describe('fromRadon', () => {
  it('drops rank A and B blocks and grades the rest', () => {
    const ranks: RadonRank[] = ['A', 'B', 'C', 'D', 'E', 'F'];
    const findings = fromRadon(radonReport(ranks.map((r) => radonBlock(r))));

    expect(findings.map((f) => f.severity)).toEqual(['MEDIUM', 'HIGH', 'HIGH', 'CRITICAL']);
    for (const finding of findings) {
      expect(finding).toMatchObject({
        line: 5,
        endLine: 40,
        column: 0,
        endColumn: null,
        category: 'COMPLEXITY',
        rule: 'cyclomatic-complexity',
      });
    }
  });

  it('names methods with their class', () => {
    const findings = fromRadon(
      radonReport([radonBlock('C'), radonBlock('C', { type: 'method', classname: 'Server' })]),
    );

    expect(findings.map((f) => f.message)).toEqual([
      "Cyclomatic complexity of 12 (rank C) in function 'handle'",
      "Cyclomatic complexity of 12 (rank C) in method 'Server.handle'",
    ]);
  });

  it('reports low maintainability once per file with no line', () => {
    const findings = fromRadon(
      radonReport(
        [],
        [
          { file: 'a.py', mi: 45.2, rank: 'A' },
          { file: 'b.py', mi: 15.04, rank: 'B' },
          { file: 'c.py', mi: 3.456, rank: 'C' },
        ],
      ),
    );

    expect(findings.map((f) => [f.file, f.severity, f.message])).toEqual([
      ['b.py', 'MEDIUM', 'Maintainability index of 15.0 (rank B)'],
      ['c.py', 'HIGH', 'Maintainability index of 3.5 (rank C)'],
    ]);
    for (const finding of findings) {
      expect(finding).toMatchObject({
        line: null,
        endLine: null,
        category: 'MAINTAINABILITY',
        rule: 'maintainability-index',
      });
    }
  });
});

describe('fromCheckstyle', () => {
  it('grades by the level our config gave the check', () => {
    const levels: CheckstyleLevel[] = ['error', 'warning', 'note'];
    const findings = fromCheckstyle(checkstyleReport(levels.map((l) => violation(l, 'EmptyBlock'))));

    expect(findings.map((f) => f.severity)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
  });

  it('puts complexity and file length in their own categories', () => {
    const findings = fromCheckstyle(
      checkstyleReport([
        violation('warning', 'CyclomaticComplexity'),
        violation('warning', 'MethodLength'),
        violation('warning', 'FileLength'),
        violation('error', 'EqualsHashCode'),
      ]),
    );

    expect(findings.map((f) => f.category)).toEqual([
      'COMPLEXITY',
      'COMPLEXITY',
      'MAINTAINABILITY',
      'CODE_SMELL',
    ]);
  });

  it('keeps the position and has no end', () => {
    const [finding] = fromCheckstyle(checkstyleReport([violation('error', 'EqualsHashCode')]));

    expect(finding).toMatchObject({
      file: 'src/App.java',
      line: 12,
      endLine: null,
      column: 5,
      endColumn: null,
      rule: 'EqualsHashCode',
      message: 'msg',
      tool: 'checkstyle',
    });
  });
});

describe('fromPmd', () => {
  it('grades by the priority our ruleset gave the rule', () => {
    const priorities: PmdPriority[] = [1, 2, 3, 4, 5];
    const findings = fromPmd(pmdReport(priorities.map((p) => pmdViolation(p, 'CloseResource'))));

    expect(findings.map((f) => f.severity)).toEqual(['HIGH', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
  });

  it('files the security rule set as vulnerabilities and sorts out the design rules', () => {
    const findings = fromPmd(
      pmdReport([
        pmdViolation(1, 'HardCodedCryptoKey', 'Security'),
        pmdViolation(3, 'CognitiveComplexity', 'Design'),
        pmdViolation(3, 'GodClass', 'Design'),
        pmdViolation(2, 'CloseResource'),
      ]),
    );

    expect(findings.map((f) => f.category)).toEqual([
      'VULNERABILITY',
      'COMPLEXITY',
      'MAINTAINABILITY',
      'CODE_SMELL',
    ]);
  });

  it('keeps the whole range pmd gives', () => {
    const [finding] = fromPmd(pmdReport([pmdViolation(2, 'CloseResource')]));

    expect(finding).toMatchObject({
      file: 'src/App.java',
      line: 20,
      endLine: 24,
      column: 9,
      endColumn: 30,
      rule: 'CloseResource',
      message: 'msg',
      tool: 'pmd',
    });
  });
});

describe('fromJscpd', () => {
  it('grades clones by size', () => {
    const findings = fromJscpd(jscpdReport([clone(29), clone(30), clone(99), clone(100)]));

    expect(findings.map((f) => f.severity)).toEqual(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH']);
  });

  it('points at the first copy and names the second', () => {
    const [finding] = fromJscpd(jscpdReport([clone(30)]));

    expect(finding).toMatchObject({
      file: 'src/a.ts',
      line: 1,
      endLine: 30,
      category: 'DUPLICATION',
      rule: 'duplicated-block',
      message: '30 duplicated lines, also in src/b.ts:50-79',
      tool: 'jscpd',
    });
  });
});

// One report per analyzer, reused by the tests below.
const everything: AnalyzerReports = {
  eslint: eslintReport([lint('no-console')]),
  pylint: pylintReport([pylintMessage('warning', 'unused-import')]),
  bandit: banditReport([banditResult('HIGH', 'HIGH')]),
  radon: radonReport([radonBlock('D')], [{ file: 'app.py', mi: 10, rank: 'B' }]),
  checkstyle: checkstyleReport([violation('warning', 'NestedIfDepth')]),
  pmd: pmdReport([pmdViolation(2, 'CloseResource')]),
  jscpd: jscpdReport([clone(40)], 12.5),
  todoScan: report,
};

describe('debt minutes', () => {
  it('come from the cost table for every tool', () => {
    const { findings } = normalize(everything);

    for (const finding of findings) {
      expect(finding.debtMinutes).toBe(DEBT_COST_TABLE[finding.category][finding.severity]);
      expect(finding.state).toBe('UNKNOWN');
    }
    // a critical vulnerability is the most expensive thing in the table
    expect(findings.find((f) => f.tool === 'bandit')?.debtMinutes).toBe(60);
  });
});

describe('normalize', () => {
  it('returns nothing when no analyzer ran', () => {
    expect(normalize({})).toEqual({ findings: [], duplicationPct: 0 });
  });

  it('passes the jscpd percentage through', () => {
    expect(normalize(everything).duplicationPct).toBe(12.5);
  });

  it('sorts by tool first', () => {
    const tools = normalize(everything).findings.map((f) => f.tool);

    expect([...new Set(tools)]).toEqual([
      'bandit',
      'checkstyle',
      'eslint',
      'jscpd',
      'pmd',
      'pylint',
      'radon',
      'todo-scan',
    ]);
  });

  it('then by file, line and rule', () => {
    const { findings } = normalize({
      eslint: {
        results: [
          { filePath: 'src/b.ts', messages: [lint('semi', 1, { line: 2 })] },
          {
            filePath: 'src/a.ts',
            messages: [
              lint('semi', 1, { line: 9 }),
              lint('eqeqeq', 1, { line: 9 }),
              lint('semi', 1, { line: 1 }),
            ],
          },
        ],
        errorCount: 0,
        warningCount: 4,
      },
    });

    expect(findings.map((f) => `${f.file}:${f.line} ${f.rule}`)).toEqual([
      'src/a.ts:1 semi',
      'src/a.ts:9 eqeqeq',
      'src/a.ts:9 semi',
      'src/b.ts:2 semi',
    ]);
  });

  it('puts file-level findings with no line before line findings', () => {
    const radon = normalize(everything).findings.filter((f) => f.tool === 'radon');

    expect(radon.map((f) => f.rule)).toEqual(['maintainability-index', 'cyclomatic-complexity']);
  });

  it('gives the same list whatever order the tools report in', () => {
    const shuffled: AnalyzerReports = {
      ...everything,
      todoScan: { ...report, matches: [...report.matches].reverse() },
      radon: radonReport(
        [radonBlock('F', { lineno: 90 }), radonBlock('D')],
        [{ file: 'app.py', mi: 10, rank: 'B' }],
      ),
    };
    const ordered: AnalyzerReports = {
      ...everything,
      radon: radonReport(
        [radonBlock('D'), radonBlock('F', { lineno: 90 })],
        [{ file: 'app.py', mi: 10, rank: 'B' }],
      ),
    };

    expect(normalize(shuffled)).toEqual(normalize(ordered));
  });
});
