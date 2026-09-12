import type {
  AnalysisFinding,
  FindingCategory,
  Severity,
} from '@codehealth/shared';

import type { BanditLevel, BanditReport } from '../analyzers/bandit';
import type { EslintReport } from '../analyzers/eslint';
import type { JscpdReport } from '../analyzers/jscpd';
import type { PylintMessageType, PylintReport } from '../analyzers/pylint';
import type { RadonMiRank, RadonRank, RadonReport } from '../analyzers/radon';

// Remediation minutes per finding. Exported because the debt score is the sum of
// these and has to use the same numbers.
export const DEBT_COST_TABLE: Record<FindingCategory, Record<Severity, number>> = {
  VULNERABILITY: { CRITICAL: 60, HIGH: 30, MEDIUM: 15, LOW: 10, INFO: 5 },
  COMPLEXITY: { CRITICAL: 45, HIGH: 25, MEDIUM: 15, LOW: 8, INFO: 3 },
  DUPLICATION: { CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 5, INFO: 2 },
  CODE_SMELL: { CRITICAL: 20, HIGH: 10, MEDIUM: 5, LOW: 3, INFO: 1 },
  MAINTAINABILITY: { CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 5, INFO: 2 },
};

// Everything a tool can say about a finding. The last two fields follow from
// these, so no mapper sets them by hand.
type RawFinding = Omit<AnalysisFinding, 'state' | 'debtMinutes'>;

const complete = (raw: RawFinding): AnalysisFinding => ({
  ...raw,
  // Set by the matcher later, against the previous snapshot.
  state: 'UNKNOWN',
  debtMinutes: DEBT_COST_TABLE[raw.category][raw.severity],
});

// ── ESLint ──

const eslintCategories: Record<string, FindingCategory> = {
  complexity: 'COMPLEXITY',
  'max-depth': 'COMPLEXITY',
  'max-lines-per-function': 'COMPLEXITY',
  'sonarjs/cognitive-complexity': 'COMPLEXITY',
  'sonarjs/no-identical-functions': 'DUPLICATION',
  'sonarjs/no-duplicated-branches': 'DUPLICATION',
  'sonarjs/no-duplicate-string': 'DUPLICATION',
  // sonarjs carries security rules too, and the plugin gives no tag to spot them
  // by. Left unlisted they would score as style issues — a hardcoded password is
  // not a style issue, and the security plugin doesn't cover these.
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
};

export function fromEslint(report: EslintReport): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  for (const file of report.results) {
    for (const message of file.messages) {
      // A parse error means our fixed config couldn't read the file. That's a
      // fact about this worker, not about their code.
      if (message.fatal || !message.ruleId) continue;

      const category =
        eslintCategories[message.ruleId] ??
        (message.ruleId.startsWith('security/') ? 'VULNERABILITY' : 'CODE_SMELL');

      // Both security rule sets only ever say "make sure this is safe", and they
      // disagree on level for the same kind of defect — the security plugin ships
      // every rule as a warning, sonarjs as an error — so the level tells us
      // nothing here and they all land on HIGH. Only bandit, which reports its
      // own confidence, is sure enough about a vulnerability to be CRITICAL.
      const severity: Severity =
        category === 'VULNERABILITY' ? 'HIGH' : message.severity === 2 ? 'HIGH' : 'MEDIUM';

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

// The rest of pylint's too-many family is about class design and file size, which
// reads better as a smell than as complexity.
const pylintCategories: Record<string, FindingCategory> = {
  'too-many-branches': 'COMPLEXITY',
  'too-many-statements': 'COMPLEXITY',
  'too-many-nested-blocks': 'COMPLEXITY',
  'too-many-locals': 'COMPLEXITY',
  'too-many-arguments': 'COMPLEXITY',
  'too-many-positional-arguments': 'COMPLEXITY',
  'too-many-return-statements': 'COMPLEXITY',
  'too-many-boolean-expressions': 'COMPLEXITY',
  'duplicate-code': 'DUPLICATION',
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
      // The symbol reads better than the message-id and is just as stable.
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
    // A high-severity issue bandit is also sure about is the only thing in the
    // pipeline that reaches CRITICAL, so the gate's critical threshold can fire.
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

// Rank A and B are healthy code; reporting them would bury the blocks that matter.
const radonSeverities: Partial<Record<RadonRank, Severity>> = {
  C: 'MEDIUM',
  D: 'HIGH',
  E: 'HIGH',
  F: 'CRITICAL',
};

// Rank A is a maintainability index of 20 or better, which is fine.
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

export interface AnalyzerReports {
  eslint?: EslintReport;
  pylint?: PylintReport;
  bandit?: BanditReport;
  radon?: RadonReport;
  jscpd?: JscpdReport;
}

/**
 * Flattens whatever analyzers ran into the one finding shape the rest of the
 * pipeline works in. Pure — the same reports always give the same list back,
 * which is what lets a score be recomputed and explained later.
 */
export function normalize(reports: AnalyzerReports) {
  const findings = [
    ...(reports.eslint ? fromEslint(reports.eslint) : []),
    ...(reports.pylint ? fromPylint(reports.pylint) : []),
    ...(reports.bandit ? fromBandit(reports.bandit) : []),
    ...(reports.radon ? fromRadon(reports.radon) : []),
    ...(reports.jscpd ? fromJscpd(reports.jscpd) : []),
  ];

  // No analyzer promises an order, and the same commit has to produce the same
  // list every time.
  findings.sort(
    (a, b) =>
      a.tool.localeCompare(b.tool) ||
      (a.file ?? '').localeCompare(b.file ?? '') ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.rule.localeCompare(b.rule),
  );

  // jscpd reports duplication as clone pairs and as one percentage for the repo.
  // The pairs became findings above; the scorer wants the percentage.
  return { findings, duplicationPct: reports.jscpd?.percentage ?? 0 };
}
