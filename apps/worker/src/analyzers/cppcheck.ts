import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

// 2 min per analyzer
const timeoutMs = 120_000;
// big repos go past the 1 MB default
const maxBuffer = 32 * 1024 * 1024;

// build output and vendored code
const ignoredDirs = ['build', 'cmake-build-*', 'third_party', 'vendor', 'external', 'node_modules'];

// message last so a tab in it can't shift the other fields
const template = ['{file}', '{line}', '{column}', '{severity}', '{id}', '{cwe}', '{message}'].join('\\t');
const fieldCount = 7;

// usually because we don't pass include paths, so not their fault
const parseFailures = new Set(['syntaxError', 'unknownMacro', 'internalAstError']);

export type CppcheckSeverity =
  | 'error'
  | 'warning'
  | 'style'
  | 'performance'
  | 'portability'
  | 'information';

export interface CppcheckFinding {
  file: string;
  line: number;
  column: number;
  severity: CppcheckSeverity;
  id: string;
  cwe: number;
  message: string;
}

export interface CppcheckReport {
  findings: CppcheckFinding[];
  // files it couldn't parse
  errors: { file: string; reason: string }[];
  counts: Record<CppcheckSeverity, number>;
}

// needs cppcheck installed on PATH
export async function runCppcheck(repoPath: string): Promise<CppcheckReport> {
  // information is mostly missing-include noise, unusedFunction flags every public api
  const args = [
    '-q',
    '--enable=warning,style,performance,portability',
    `--template=${template}`,
    ...ignoredDirs.flatMap((dir) => ['-i', dir]),
    '.',
  ];

  // exits 0 even with findings
  const { stderr } = await run('cppcheck', args, { cwd: repoPath, timeout: timeoutMs, maxBuffer });

  const findings: CppcheckFinding[] = [];
  const errors: CppcheckReport['errors'] = [];
  const counts: Record<CppcheckSeverity, number> = {
    error: 0,
    warning: 0,
    style: 0,
    performance: 0,
    portability: 0,
    information: 0,
  };

  for (const line of stderr.split('\n')) {
    if (!line.trim()) continue;

    const fields = line.split('\t');
    // output isn't in the format we asked for
    if (fields.length < fieldCount) {
      throw new Error(`cppcheck output wasn't in the expected format: ${line}`);
    }

    const [file, lineNo, column, severity, id, cwe] = fields;
    const message = fields.slice(fieldCount - 1).join('\t');

    if (parseFailures.has(id)) {
      errors.push({ file, reason: message });
      continue;
    }

    counts[severity as CppcheckSeverity]++;
    findings.push({
      file,
      line: Number(lineNo),
      column: Number(column),
      severity: severity as CppcheckSeverity,
      id,
      cwe: Number(cwe),
      message,
    });
  }

  return { findings, errors, counts };
}
