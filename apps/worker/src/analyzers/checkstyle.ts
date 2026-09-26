import { execFile } from 'child_process';
import { relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const run = promisify(execFile);

// The pipeline allows each analyzer two minutes.
const timeoutMs = 120_000;
// A big repo's report goes well past the 1 MB default.
const maxBuffer = 32 * 1024 * 1024;

// Not on npm, and too big to commit. Until the worker image exists, fetch it with:
//   curl -L -o apps/worker/vendor/checkstyle-13.8.0-all.jar \
//     https://github.com/checkstyle/checkstyle/releases/download/checkstyle-13.8.0/checkstyle-13.8.0-all.jar
// Pinned for the same reason as the python tools: a new version changes what fires.
const jarPath = resolve(__dirname, '../../vendor/checkstyle-13.8.0-all.jar');
const configPath = resolve(__dirname, '../../checkstyle-analysis.xml');

// Build output, generated and vendored code isn't the author's work.
const excludes = '/(target|build|out|\\.gradle|node_modules)/';

// Checkstyle reports a file it couldn't parse as a violation of the Checker itself.
const parseFailure = 'com.puppycrawl.tools.checkstyle.Checker';

export type CheckstyleLevel = 'error' | 'warning' | 'note';

export interface CheckstyleViolation {
  file: string;
  line: number;
  column: number | null;
  level: CheckstyleLevel;
  rule: string;
  message: string;
}

export interface CheckstyleReport {
  violations: CheckstyleViolation[];
  // Files it couldn't parse, so nothing in them got checked.
  errors: { file: string; reason: string }[];
  counts: Record<CheckstyleLevel, number>;
}

interface SarifResult {
  ruleId: string;
  level: CheckstyleLevel;
  message: { text: string };
  locations: {
    physicalLocation: {
      artifactLocation: { uri: string };
      region: { startLine: number; startColumn?: number };
    };
  }[];
}

interface SarifOutput {
  runs: { results: SarifResult[] }[];
}

/**
 * Checks a cloned checkout with the worker's own config and hands back what
 * checkstyle found, flattened out of SARIF. Turning it into findings is the
 * normalize stage's job.
 */
export async function runCheckstyle(repoPath: string): Promise<CheckstyleReport> {
  const args = ['-jar', jarPath, '-c', configPath, '-f', 'sarif', '-x', excludes, '.'];

  let stdout: string;
  let stderr: string;

  try {
    ({ stdout, stderr } = await run('java', args, { cwd: repoPath, timeout: timeoutMs, maxBuffer }));
  } catch (err) {
    // The exit code is the number of errors it found, so any number is a normal
    // run. No java, or a timeout kill, is a real failure.
    const failed = err as { code?: unknown; killed?: boolean; stdout?: string; stderr?: string };
    if (failed.killed || typeof failed.code !== 'number') throw err;
    stdout = failed.stdout ?? '';
    stderr = failed.stderr ?? '';
  }

  // Parsing is the real check that checkstyle ran — a missing jar or a bad
  // config leaves something that isn't JSON, and that has to surface rather
  // than read as a clean repo.
  let output: SarifOutput;
  try {
    output = JSON.parse(stdout) as SarifOutput;
  } catch {
    throw new Error(`checkstyle produced no readable output, is it installed? ${stderr.trim()}`);
  }

  const violations: CheckstyleViolation[] = [];
  const errors: CheckstyleReport['errors'] = [];
  const counts: Record<CheckstyleLevel, number> = { error: 0, warning: 0, note: 0 };

  for (const result of output.runs[0].results) {
    const { artifactLocation, region } = result.locations[0].physicalLocation;
    // Paths come back as absolute file: URIs.
    const file = relative(repoPath, fileURLToPath(artifactLocation.uri));

    if (result.ruleId === parseFailure) {
      // The rest of the message is a java stack trace.
      errors.push({ file, reason: result.message.text.split('\n')[0] });
      continue;
    }

    counts[result.level]++;
    violations.push({
      file,
      line: region.startLine,
      column: region.startColumn ?? null,
      level: result.level,
      // ...checks.coding.EqualsHashCodeCheck -> EqualsHashCode
      rule: result.ruleId.split('.').pop()!.replace(/Check$/, ''),
      message: result.message.text,
    });
  }

  return { violations, errors, counts };
}
