import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

// The pipeline allows each analyzer two minutes.
const timeoutMs = 120_000;
// A big repo's report goes well past the 1 MB default.
const maxBuffer = 32 * 1024 * 1024;

// Same list the pylint config ignores: vendored, generated and virtualenv code
// isn't the author's work, and scanning it buries whatever they did write.
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

// Bandit matches these against the whole path it walked, so a bare directory
// name never hits. The wildcards are what catch the directory at any depth.
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

/**
 * Scans a cloned checkout for security issues and hands back bandit's output as
 * it came. Turning it into findings is the normalize stage's job.
 */
export async function runBandit(repoPath: string): Promise<BanditReport> {
  // Run from inside the repo so the temp workspace name never reaches the
  // paths, the way the other analyzers do it.
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
    // Exit 1 just means it found issues and the report is still on stdout.
    // Anything else — bad arguments, or a timeout kill — is a real failure.
    const failed = err as { code?: number; stdout?: string; stderr?: string };
    if (failed.code !== 1) throw err;
    stdout = failed.stdout ?? '';
    stderr = failed.stderr ?? '';
  }

  // Parsing is the real check that bandit ran — a crash or a missing bandit
  // leaves something that isn't JSON, and that has to surface rather than read
  // as a clean repo.
  let output: BanditOutput;
  try {
    output = JSON.parse(stdout) as BanditOutput;
  } catch {
    throw new Error(`bandit produced no readable output, is it installed? ${stderr.trim()}`);
  }

  const counts: Record<BanditLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, UNDEFINED: 0 };

  // Scanning '.' prefixes every path with './', which the other analyzers don't do.
  const strip = (filename: string) => filename.replace(/^\.\//, '');

  const results = output.results.map((result) => {
    counts[result.issue_severity]++;
    return { ...result, filename: strip(result.filename) };
  });

  const errors = output.errors.map((error) => ({ ...error, filename: strip(error.filename) }));

  return { results, errors, counts, nosec: output.metrics._totals.nosec };
}
