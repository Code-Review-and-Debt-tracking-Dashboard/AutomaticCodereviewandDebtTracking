import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

// The pipeline allows each analyzer two minutes.
const timeoutMs = 120_000;
// A big repo's report goes well past the 1 MB default.
const maxBuffer = 32 * 1024 * 1024;

// Build output and vendored code isn't the author's work. Cppcheck matches
// these at any depth.
const ignoredDirs = ['build', 'cmake-build-*', 'third_party', 'vendor', 'external', 'node_modules'];

// One finding per line. The message goes last so a tab inside it can't shift
// the other fields.
const template = ['{file}', '{line}', '{column}', '{severity}', '{id}', '{cwe}', '{message}'].join('\\t');
const fieldCount = 7;

// Cppcheck couldn't make sense of the file. We never pass it the repo's include
// paths or macros, so that's usually our setup, not their code.
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
  // Files it couldn't parse, so nothing in them got checked.
  errors: { file: string; reason: string }[];
  counts: Record<CppcheckSeverity, number>;
}

/**
 * Checks a cloned checkout for C/C++ bugs and hands back what cppcheck found.
 * Turning it into findings is the normalize stage's job.
 *
 * Needs cppcheck on PATH. Unlike the Java tools it's a native binary, so it
 * can't be dropped in vendor/. The worker image has it; on the host,
 * `brew install cppcheck`.
 */
export async function runCppcheck(repoPath: string): Promise<CppcheckReport> {
  // information is left out because without the repo's include paths it's
  // mostly "missing include" noise, and unusedFunction because a library's
  // public functions are never called from inside it. --inline-suppr isn't
  // passed, so suppressions in their code don't count, same as the other tools.
  const args = [
    '-q',
    '--enable=warning,style,performance,portability',
    `--template=${template}`,
    ...ignoredDirs.flatMap((dir) => ['-i', dir]),
    '.',
  ];

  // Exits 0 whatever it finds, so a non-zero exit is a real failure and throws.
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
    // There's no JSON to fail parsing here, so this is the check that the output
    // is what we asked for. Anything else must not read as a clean repo.
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
