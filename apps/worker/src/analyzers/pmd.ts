import { execFile } from 'child_process';
import { resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

// The pipeline allows each analyzer two minutes.
const timeoutMs = 120_000;
// A big repo's report goes well past the 1 MB default.
const maxBuffer = 32 * 1024 * 1024;

// Not on npm, and too big to commit. Until the worker image exists, fetch it with:
//   curl -L -o /tmp/pmd.zip \
//     https://github.com/pmd/pmd/releases/download/pmd_releases%2F7.27.0/pmd-dist-7.27.0-bin.zip
//   unzip /tmp/pmd.zip -d apps/worker/vendor
// Pinned for the same reason as the other tools: a new version changes what fires.
const pmdPath = resolve(__dirname, '../../vendor/pmd-bin-7.27.0/bin/pmd');
const rulesetPath = resolve(__dirname, '../../pmd-analysis.xml');

// 1 is the most serious.
export type PmdPriority = 1 | 2 | 3 | 4 | 5;

export interface PmdViolation {
  file: string;
  line: number;
  endLine: number;
  column: number;
  endColumn: number;
  rule: string;
  ruleSet: string;
  priority: PmdPriority;
  message: string;
}

export interface PmdReport {
  violations: PmdViolation[];
  // Files it couldn't parse, so nothing in them got checked.
  errors: { file: string; reason: string }[];
  counts: Record<PmdPriority, number>;
}

interface PmdOutput {
  files: {
    filename: string;
    violations: {
      beginline: number;
      begincolumn: number;
      endline: number;
      endcolumn: number;
      description: string;
      rule: string;
      ruleset: string;
      priority: PmdPriority;
    }[];
  }[];
  processingErrors: { filename: string; message: string }[];
}

/**
 * Checks a cloned checkout with the worker's own ruleset and hands back what
 * pmd found, flattened out of its per-file report. Turning it into findings is
 * the normalize stage's job.
 */
export async function runPmd(repoPath: string): Promise<PmdReport> {
  // Without the two --no-fail flags pmd exits non-zero for finding anything,
  // so with them any non-zero exit is a real failure and can just throw.
  // --no-cache stops it keeping state between runs.
  const args = [
    'check',
    '-d',
    '.',
    '-R',
    rulesetPath,
    '-f',
    'json',
    '--no-cache',
    '--no-progress',
    '--no-fail-on-violation',
    '--no-fail-on-error',
  ];

  const { stdout, stderr } = await run(pmdPath, args, {
    cwd: repoPath,
    timeout: timeoutMs,
    maxBuffer,
  });

  // Parsing is the real check that pmd ran — anything that isn't JSON has to
  // surface rather than read as a clean repo.
  let output: PmdOutput;
  try {
    output = JSON.parse(stdout) as PmdOutput;
  } catch {
    throw new Error(`pmd produced no readable output, is it installed? ${stderr.trim()}`);
  }

  // Scanning '.' prefixes every path with './', which the other analyzers don't do.
  const strip = (filename: string) => filename.replace(/^\.\//, '');

  const counts: Record<PmdPriority, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const violations: PmdViolation[] = [];

  for (const file of output.files) {
    for (const v of file.violations) {
      counts[v.priority]++;
      violations.push({
        file: strip(file.filename),
        line: v.beginline,
        endLine: v.endline,
        column: v.begincolumn,
        endColumn: v.endcolumn,
        rule: v.rule,
        ruleSet: v.ruleset,
        priority: v.priority,
        message: v.description,
      });
    }
  }

  // The rest of the message is the parser's list of what it expected.
  const errors = output.processingErrors.map((error) => ({
    file: strip(error.filename),
    reason: error.message.split('\n')[0],
  }));

  return { violations, errors, counts };
}
