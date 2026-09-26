import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

// 2 min per analyzer
const timeoutMs = 120_000;
// big repos go past the 1 MB default
const maxBuffer = 32 * 1024 * 1024;

// vendored, generated and virtualenv code
const ignoredDirs = [
  '.venv',
  'venv',
  'env',
  '__pycache__',
  'site-packages',
  'node_modules',
  'build',
  'dist',
  'migrations',
];

// needs wildcards to match at any depth
const excludes = ignoredDirs.map((dir) => `*/${dir}/*`).join(',');

export type BanditLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNDEFINED';

export interface BanditResult {
  filename: string;
  line_number: number;
  line_range: number[];
  col_offset: number;
  end_col_offset: number;
  test_id: string;
  test_name: string;
  issue_severity: BanditLevel;
  issue_confidence: BanditLevel;
  issue_text: string;
  issue_cwe: { id: number; link: string } | null;
  more_info: string;
  code: string;
}

export interface BanditError {
  filename: string;
  reason: string;
}

export interface BanditReport {
  results: BanditResult[];
  errors: BanditError[];
  counts: Record<BanditLevel, number>;
  nosec: number;
}

interface BanditOutput {
  results: BanditResult[];
  errors: BanditError[];
  metrics: { _totals: { nosec: number } };
}

export async function runBandit(repoPath: string): Promise<BanditReport> {
  // run inside the repo so paths stay relative
  const args = ['-m', 'bandit', '-r', '.', '-f', 'json', '-x', excludes];

  let stdout: string;
  let stderr: string;

  try {
    ({ stdout, stderr } = await run('python3', args, {
      cwd: repoPath,
      timeout: timeoutMs,
      maxBuffer,
    }));
  } catch (err) {
    // exit 1 just means it found issues
    const failed = err as { code?: number; stdout?: string; stderr?: string };
    if (failed.code !== 1) throw err;
    stdout = failed.stdout ?? '';
    stderr = failed.stderr ?? '';
  }

  // bad JSON means bandit didn't run properly
  let output: BanditOutput;
  try {
    output = JSON.parse(stdout) as BanditOutput;
  } catch {
    throw new Error(`bandit produced no readable output, is it installed? ${stderr.trim()}`);
  }

  const counts: Record<BanditLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, UNDEFINED: 0 };

  // drop the leading ./
  const strip = (filename: string) => filename.replace(/^\.\//, '');

  const results = output.results.map((result) => {
    counts[result.issue_severity]++;
    return { ...result, filename: strip(result.filename) };
  });

  const errors = output.errors.map((error) => ({ ...error, filename: strip(error.filename) }));

  return { results, errors, counts, nosec: output.metrics._totals.nosec };
}
