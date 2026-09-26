import { execFile } from 'child_process';
import { relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const run = promisify(execFile);

// 2 min per analyzer
const timeoutMs = 120_000;
// big repos go past the 1 MB default
const maxBuffer = 32 * 1024 * 1024;

// not on npm, download it with:
//   curl -L -o apps/worker/vendor/checkstyle-13.8.0-all.jar \
//     https://github.com/checkstyle/checkstyle/releases/download/checkstyle-13.8.0/checkstyle-13.8.0-all.jar
const jarPath = resolve(__dirname, '../../vendor/checkstyle-13.8.0-all.jar');
const configPath = resolve(__dirname, '../../checkstyle-analysis.xml');

// build output and vendored code
const excludes = '/(target|build|out|\\.gradle|node_modules)/';

// parse failures show up under this rule id
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
  // files it couldn't parse
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

export async function runCheckstyle(repoPath: string): Promise<CheckstyleReport> {
  const args = ['-jar', jarPath, '-c', configPath, '-f', 'sarif', '-x', excludes, '.'];

  let stdout: string;
  let stderr: string;

  try {
    ({ stdout, stderr } = await run('java', args, { cwd: repoPath, timeout: timeoutMs, maxBuffer }));
  } catch (err) {
    // exit code is the error count, so only a missing java or timeout is a failure
    const failed = err as { code?: unknown; killed?: boolean; stdout?: string; stderr?: string };
    if (failed.killed || typeof failed.code !== 'number') throw err;
    stdout = failed.stdout ?? '';
    stderr = failed.stderr ?? '';
  }

  // bad JSON means checkstyle didn't run properly
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
    // paths are absolute file: URIs
    const file = relative(repoPath, fileURLToPath(artifactLocation.uri));

    if (result.ruleId === parseFailure) {
      // rest is a stack trace
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
