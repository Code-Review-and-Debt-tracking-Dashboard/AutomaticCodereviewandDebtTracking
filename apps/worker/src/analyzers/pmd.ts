import { execFile } from 'child_process';
import { resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

// 2 min per analyzer
const timeoutMs = 120_000;
// big repos go past the 1 MB default
const maxBuffer = 32 * 1024 * 1024;

// not on npm, download it with:
//   curl -L -o /tmp/pmd.zip \
//     https://github.com/pmd/pmd/releases/download/pmd_releases%2F7.27.0/pmd-dist-7.27.0-bin.zip
//   unzip /tmp/pmd.zip -d apps/worker/vendor
const pmdPath = resolve(__dirname, '../../vendor/pmd-bin-7.27.0/bin/pmd');
const rulesetPath = resolve(__dirname, '../../pmd-analysis.xml');

// 1 = most serious
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
  // files it couldn't parse
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

export async function runPmd(repoPath: string): Promise<PmdReport> {
  // --no-fail flags so finding issues doesn't count as a failed run
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

  // bad JSON means pmd didn't run properly
  let output: PmdOutput;
  try {
    output = JSON.parse(stdout) as PmdOutput;
  } catch {
    throw new Error(`pmd produced no readable output, is it installed? ${stderr.trim()}`);
  }

  // drop the leading ./
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

  // keep only the first line
  const errors = output.processingErrors.map((error) => ({
    file: strip(error.filename),
    reason: error.message.split('\n')[0],
  }));

  return { violations, errors, counts };
}
