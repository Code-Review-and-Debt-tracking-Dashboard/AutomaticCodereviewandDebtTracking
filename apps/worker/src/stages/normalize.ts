import type {
  AnalysisFinding,
  FindingCategory,
  Severity,
} from '@codehealth/shared';

import type { BanditLevel, BanditReport } from '../analyzers/bandit';
import type { CheckstyleLevel, CheckstyleReport } from '../analyzers/checkstyle';
import type { CppcheckReport, CppcheckSeverity } from '../analyzers/cppcheck';
import type { EslintReport } from '../analyzers/eslint';
import type { JscpdReport } from '../analyzers/jscpd';
import type { PmdPriority, PmdReport } from '../analyzers/pmd';
import type { PylintMessageType, PylintReport } from '../analyzers/pylint';
import type { RadonMiRank, RadonRank, RadonReport } from '../analyzers/radon';
import type { TodoMarker, TodoScanReport } from '../analyzers/todoScan';
import { isTestPath } from '../lib/testCode';

// fix time in minutes per finding, the debt score sums these
export const DEBT_COST_TABLE: Record<FindingCategory, Record<Severity, number>> = {
  VULNERABILITY: { CRITICAL: 60, HIGH: 30, MEDIUM: 15, LOW: 10, INFO: 5 },
  COMPLEXITY: { CRITICAL: 45, HIGH: 25, MEDIUM: 15, LOW: 8, INFO: 3 },
  DUPLICATION: { CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 5, INFO: 2 },
  CODE_SMELL: { CRITICAL: 20, HIGH: 10, MEDIUM: 5, LOW: 3, INFO: 1 },
  MAINTAINABILITY: { CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 5, INFO: 2 },
};

type RawFinding = Omit<AnalysisFinding, 'state' | 'debtMinutes'>;

const complete = (raw: RawFinding): AnalysisFinding => ({
  ...raw,
  // matcher sets this later
  state: 'UNKNOWN',
  debtMinutes: DEBT_COST_TABLE[raw.category][raw.severity],
});

// ── ESLint ──

const eslintCategories: Record<string, FindingCategory> = {
  complexity: 'COMPLEXITY',
  'max-depth': 'COMPLEXITY',
  'max-lines-per-function': 'COMPLEXITY',
  'sonarjs/no-identical-functions': 'DUPLICATION',
  'sonarjs/no-duplicated-branches': 'DUPLICATION',
  'sonarjs/no-duplicate-string': 'DUPLICATION',
  // sonarjs security rules, otherwise they'd count as code smells
  'sonarjs/code-eval': 'VULNERABILITY',
  'sonarjs/no-hardcoded-passwords': 'VULNERABILITY',
  'sonarjs/no-hardcoded-secrets': 'VULNERABILITY',
  'sonarjs/no-clear-text-protocols': 'VULNERABILITY',
  'sonarjs/insecure-jwt-token': 'VULNERABILITY',
  'sonarjs/sql-queries': 'VULNERABILITY',
  'sonarjs/hashing': 'VULNERABILITY',
  'sonarjs/no-weak-cipher': 'VULNERABILITY',
  'sonarjs/no-weak-keys': 'VULNERABILITY',
  'sonarjs/encryption-secure-mode': 'VULNERABILITY',
  'sonarjs/pseudo-random': 'VULNERABILITY',
  'sonarjs/content-security-policy': 'VULNERABILITY',
  'sonarjs/strict-transport-security': 'VULNERABILITY',
  'sonarjs/x-powered-by': 'VULNERABILITY',
  'sonarjs/xml-parser-xxe': 'VULNERABILITY',
  'sonarjs/weak-ssl': 'VULNERABILITY',
  'sonarjs/unverified-hostname': 'VULNERABILITY',
  'sonarjs/unverified-certificate': 'VULNERABILITY',
  'sonarjs/slow-regex': 'VULNERABILITY',
  'sonarjs/session-regeneration': 'VULNERABILITY',
  'sonarjs/publicly-writable-directories': 'VULNERABILITY',
  'sonarjs/production-debug': 'VULNERABILITY',
  'sonarjs/post-message': 'VULNERABILITY',
  'sonarjs/no-referrer-policy': 'VULNERABILITY',
  'sonarjs/no-os-command-from-path': 'VULNERABILITY',
  'sonarjs/no-hardcoded-ip': 'VULNERABILITY',
  'sonarjs/no-angular-bypass-sanitization': 'VULNERABILITY',
  'sonarjs/link-with-target-blank': 'VULNERABILITY',
  'sonarjs/insecure-cookie': 'VULNERABILITY',
  'sonarjs/file-uploads': 'VULNERABILITY',
  'sonarjs/file-permissions': 'VULNERABILITY',
  'sonarjs/disabled-resource-integrity': 'VULNERABILITY',
  'sonarjs/disabled-auto-escaping': 'VULNERABILITY',
  'sonarjs/csrf': 'VULNERABILITY',
  'sonarjs/cors': 'VULNERABILITY',
  'sonarjs/cookie-no-httponly': 'VULNERABILITY',
  'sonarjs/content-length': 'VULNERABILITY',
  'sonarjs/no-session-cookies-on-static-assets': 'VULNERABILITY',
  'sonarjs/hardcoded-secret-signatures': 'VULNERABILITY',
  'sonarjs/dompurify-unsafe-config': 'VULNERABILITY',
  'sonarjs/dynamically-constructed-templates': 'VULNERABILITY',
  'sonarjs/no-mime-sniff': 'VULNERABILITY',
  'sonarjs/review-blockchain-mnemonic': 'VULNERABILITY',
};

// security rules matched by prefix
const eslintSecurityPrefixes = ['security/', 'sonarjs/aws-', 'no-unsanitized/'];

function eslintSeverity(category: FindingCategory, level: 1 | 2): Severity {
  // security plugins don't agree on level, so all HIGH. only bandit goes CRITICAL
  if (category === 'VULNERABILITY') return 'HIGH';
  // presets mark most style rules as errors, so drop them one step
  if (category === 'CODE_SMELL') return level === 2 ? 'MEDIUM' : 'LOW';
  return level === 2 ? 'HIGH' : 'MEDIUM';
}

export function fromEslint(report: EslintReport): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  for (const file of report.results) {
    for (const message of file.messages) {
      // parse error is our config's problem, not theirs
      if (message.fatal || !message.ruleId) continue;
      // disable comment for a plugin we don't load
      if (message.message.startsWith('Definition for rule ')) continue;

      const category =
        eslintCategories[message.ruleId] ??
        (eslintSecurityPrefixes.some((prefix) => message.ruleId!.startsWith(prefix))
          ? 'VULNERABILITY'
          : 'CODE_SMELL');

      const severity = eslintSeverity(category, message.severity);

      findings.push(
        complete({
          file: file.filePath,
          line: message.line ?? null,
          endLine: message.endLine ?? null,
          column: message.column ?? null,
          endColumn: message.endColumn ?? null,
          severity,
          category,
          rule: message.ruleId,
          message: message.message,
          tool: 'eslint',
        }),
      );
    }
  }

  return findings;
}

// ── PyLint ──

const pylintSeverities: Record<PylintMessageType, Severity> = {
  fatal: 'CRITICAL',
  error: 'HIGH',
  warning: 'MEDIUM',
  refactor: 'LOW',
  convention: 'LOW',
  information: 'INFO',
};

// other too-many-* rules count as smells
const pylintCategories: Record<string, FindingCategory> = {
  'too-many-branches': 'COMPLEXITY',
  'too-many-statements': 'COMPLEXITY',
  'too-many-nested-blocks': 'COMPLEXITY',
  'too-many-locals': 'COMPLEXITY',
  'too-many-arguments': 'COMPLEXITY',
  'too-many-positional-arguments': 'COMPLEXITY',
  'too-many-return-statements': 'COMPLEXITY',
  'too-many-boolean-expressions': 'COMPLEXITY',
};

export function fromPylint(report: PylintReport): AnalysisFinding[] {
  return report.messages.map((message) =>
    complete({
      file: message.path,
      line: message.line,
      endLine: message.endLine,
      column: message.column,
      endColumn: message.endColumn,
      severity: pylintSeverities[message.type],
      category: pylintCategories[message.symbol] ?? 'CODE_SMELL',
      rule: message.symbol,
      message: message.message,
      tool: 'pylint',
    }),
  );
}

// ── Bandit ──

const banditSeverities: Record<BanditLevel, Severity> = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNDEFINED: 'INFO',
};

export function fromBandit(report: BanditReport): AnalysisFinding[] {
  return report.results.map((result) => {
    // high severity + high confidence is the only CRITICAL
    const critical = result.issue_severity === 'HIGH' && result.issue_confidence === 'HIGH';

    return complete({
      file: result.filename,
      line: result.line_number,
      endLine: result.line_range[result.line_range.length - 1] ?? result.line_number,
      column: result.col_offset,
      endColumn: result.end_col_offset,
      severity: critical ? 'CRITICAL' : banditSeverities[result.issue_severity],
      category: 'VULNERABILITY',
      rule: result.test_id,
      message: result.issue_text,
      tool: 'bandit',
    });
  });
}

// ── Radon ──

// A and B are fine, skip them
const radonSeverities: Partial<Record<RadonRank, Severity>> = {
  C: 'MEDIUM',
  D: 'HIGH',
  E: 'HIGH',
  F: 'CRITICAL',
};

// rank A (MI >= 20) is fine
const radonMiSeverities: Partial<Record<RadonMiRank, Severity>> = {
  B: 'MEDIUM',
  C: 'HIGH',
};

export function fromRadon(report: RadonReport): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  for (const block of report.blocks) {
    const severity = radonSeverities[block.rank];
    if (!severity) continue;

    const name = block.classname ? `${block.classname}.${block.name}` : block.name;

    findings.push(
      complete({
        file: block.file,
        line: block.lineno,
        endLine: block.endline,
        column: block.col_offset,
        endColumn: null,
        severity,
        category: 'COMPLEXITY',
        rule: 'cyclomatic-complexity',
        message:
          `Cyclomatic complexity of ${block.complexity} (rank ${block.rank}) ` +
          `in ${block.type} '${name}'`,
        tool: 'radon',
      }),
    );
  }

  for (const file of report.maintainability) {
    const severity = radonMiSeverities[file.rank];
    if (!severity) continue;

    findings.push(
      complete({
        file: file.file,
        line: null,
        endLine: null,
        column: null,
        endColumn: null,
        severity,
        category: 'MAINTAINABILITY',
        rule: 'maintainability-index',
        message: `Maintainability index of ${file.mi.toFixed(1)} (rank ${file.rank})`,
        tool: 'radon',
      }),
    );
  }

  return findings;
}

// ── Checkstyle ──

const checkstyleSeverities: Record<CheckstyleLevel, Severity> = {
  error: 'HIGH',
  warning: 'MEDIUM',
  note: 'LOW',
};

const checkstyleCategories: Record<string, FindingCategory> = {
  CyclomaticComplexity: 'COMPLEXITY',
  NPathComplexity: 'COMPLEXITY',
  NestedIfDepth: 'COMPLEXITY',
  BooleanExpressionComplexity: 'COMPLEXITY',
  MethodLength: 'COMPLEXITY',
  ParameterNumber: 'COMPLEXITY',
  FileLength: 'MAINTAINABILITY',
};

export function fromCheckstyle(report: CheckstyleReport): AnalysisFinding[] {
  return report.violations.map((violation) =>
    complete({
      file: violation.file,
      line: violation.line,
      endLine: null,
      column: violation.column,
      endColumn: null,
      severity: checkstyleSeverities[violation.level],
      category: checkstyleCategories[violation.rule] ?? 'CODE_SMELL',
      rule: violation.rule,
      message: violation.message,
      tool: 'checkstyle',
    }),
  );
}

// ── PMD ──

// security rules stop at HIGH here too
const pmdSeverities: Record<PmdPriority, Severity> = {
  1: 'HIGH',
  2: 'HIGH',
  3: 'MEDIUM',
  4: 'LOW',
  5: 'INFO',
};

const pmdCategories: Record<string, FindingCategory> = {
  CognitiveComplexity: 'COMPLEXITY',
  GodClass: 'MAINTAINABILITY',
};

export function fromPmd(report: PmdReport): AnalysisFinding[] {
  return report.violations.map((violation) =>
    complete({
      file: violation.file,
      line: violation.line,
      endLine: violation.endLine,
      column: violation.column,
      endColumn: violation.endColumn,
      severity: pmdSeverities[violation.priority],
      category:
        violation.ruleSet === 'Security'
          ? 'VULNERABILITY'
          : (pmdCategories[violation.rule] ?? 'CODE_SMELL'),
      rule: violation.rule,
      message: violation.message,
      tool: 'pmd',
    }),
  );
}

// ── Cppcheck ──

// error/warning are real bugs, the rest are style
const cppcheckSeverities: Record<CppcheckSeverity, Severity> = {
  error: 'HIGH',
  warning: 'MEDIUM',
  style: 'LOW',
  performance: 'LOW',
  portability: 'LOW',
  information: 'INFO',
};

// memory safety bugs count as vulnerabilities
const cppcheckVulnerabilities = new Set([
  'arrayIndexOutOfBounds',
  'arrayIndexOutOfBoundsCond',
  'negativeIndex',
  'bufferAccessOutOfBounds',
  'pointerOutOfBounds',
  'doubleFree',
  'deallocuse',
  'deallocret',
  'invalidscanf',
  'invalidScanfFormatWidth',
  'wrongPrintfScanfArgNum',
]);

export function fromCppcheck(report: CppcheckReport): AnalysisFinding[] {
  return report.findings.map((finding) =>
    complete({
      file: finding.file,
      // 0 = whole file
      line: finding.line || null,
      endLine: null,
      column: finding.column || null,
      endColumn: null,
      severity: cppcheckSeverities[finding.severity],
      category: cppcheckVulnerabilities.has(finding.id) ? 'VULNERABILITY' : 'CODE_SMELL',
      rule: finding.id,
      message: finding.message,
      tool: 'cppcheck',
    }),
  );
}

// ── jscpd ──

export function fromJscpd(report: JscpdReport): AnalysisFinding[] {
  return report.duplicates.map((clone) =>
    complete({
      file: clone.firstFile.name,
      line: clone.firstFile.start,
      endLine: clone.firstFile.end,
      column: null,
      endColumn: null,
      severity: clone.lines >= 100 ? 'HIGH' : clone.lines >= 30 ? 'MEDIUM' : 'LOW',
      category: 'DUPLICATION',
      rule: 'duplicated-block',
      message:
        `${clone.lines} duplicated lines, also in ${clone.secondFile.name}:` +
        `${clone.secondFile.start}-${clone.secondFile.end}`,
      tool: 'jscpd',
    }),
  );
}

// ── TODO scan ──

// FIXME/HACK are worse than TODO/XXX
const todoSeverities: Record<TodoMarker, Severity> = {
  FIXME: 'MEDIUM',
  HACK: 'MEDIUM',
  TODO: 'LOW',
  XXX: 'LOW',
};

export function fromTodoScan(report: TodoScanReport): AnalysisFinding[] {
  return report.matches.map((match) =>
    complete({
      file: match.file,
      line: match.line,
      endLine: match.line,
      column: null,
      endColumn: null,
      severity: todoSeverities[match.marker],
      category: 'MAINTAINABILITY',
      rule: match.marker.toLowerCase(),
      message: match.text ? `${match.marker}: ${match.text}` : match.marker,
      tool: 'todo-scan',
    }),
  );
}

export interface AnalyzerReports {
  eslint?: EslintReport;
  pylint?: PylintReport;
  bandit?: BanditReport;
  radon?: RadonReport;
  checkstyle?: CheckstyleReport;
  pmd?: PmdReport;
  cppcheck?: CppcheckReport;
  jscpd?: JscpdReport;
  todoScan?: TodoScanReport;
}

// turns every tool's report into one finding list
export function normalize(reports: AnalyzerReports) {
  const findings = [
    ...(reports.eslint ? fromEslint(reports.eslint) : []),
    ...(reports.pylint ? fromPylint(reports.pylint) : []),
    ...(reports.bandit ? fromBandit(reports.bandit) : []),
    ...(reports.radon ? fromRadon(reports.radon) : []),
    ...(reports.checkstyle ? fromCheckstyle(reports.checkstyle) : []),
    ...(reports.pmd ? fromPmd(reports.pmd) : []),
    ...(reports.cppcheck ? fromCppcheck(reports.cppcheck) : []),
    ...(reports.jscpd ? fromJscpd(reports.jscpd) : []),
    ...(reports.todoScan ? fromTodoScan(reports.todoScan) : []),
  ].filter((f) => !f.file || !isTestPath(f.file));

  // sort so the same commit always gives the same list
  findings.sort(
    (a, b) =>
      a.tool.localeCompare(b.tool) ||
      (a.file ?? '').localeCompare(b.file ?? '') ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.rule.localeCompare(b.rule),
  );

  // scorer needs jscpd's overall percentage
  return { findings, duplicationPct: reports.jscpd?.percentage ?? 0 };
}
