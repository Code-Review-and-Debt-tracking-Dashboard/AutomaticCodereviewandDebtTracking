import { execFile } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

// 2 min per analyzer
const timeoutMs = 120_000;
// big repos go past the 1 MB default
const maxBuffer = 32 * 1024 * 1024;

// resolve via the package so workspace hoisting doesn't break it
const jscpdBin = resolve(require.resolve('jscpd/package.json'), '../run-jscpd.js');

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
  // test code isn't scored, and the percentage can't be filtered afterwards
  'test',
  'tests',
  '__tests__',
];

const testFiles = ['**/*.test.*', '**/*.spec.*', '**/test_*.py', '**/*_test.py'];

// wildcards so it matches at any depth
const ignores = [...ignoredDirs.map((dir) => `**/${dir}/**`), ...testFiles].join(',');

export interface JscpdClone {
  format: string;
  lines: number;
  tokens: number;
  firstFile: {
    name: string;
    start: number;
    end: number;
  };
  secondFile: {
    name: string;
    start: number;
    end: number;
  };
}

export interface JscpdReport {
  duplicates: JscpdClone[];
  totalLines: number;
  duplicatedLines: number;
  percentage: number;
}

interface JscpdOutput {
  duplicates: JscpdClone[];
  statistics: {
    total: { lines: number; duplicatedLines: number; percentage: number };
  };
}

const place = (file: JscpdClone['firstFile']) => ({
  name: file.name,
  start: file.start,
  end: file.end,
});

export async function runJscpd(repoPath: string): Promise<JscpdReport> {
  // json reporter writes to a file, keep it out of the repo
  const reportDir = await mkdtemp(join(tmpdir(), 'codehealth-jscpd-'));

  try {
    // run inside the repo so paths stay relative
    const args = ['.', '--reporters', 'json', '--output', reportDir, '--ignore', ignores];

    // exits 0 even with duplicates
    await run(process.execPath, [jscpdBin, ...args], {
      cwd: repoPath,
      timeout: timeoutMs,
      maxBuffer,
    });

    let output: JscpdOutput;
    try {
      const raw = await readFile(join(reportDir, 'jscpd-report.json'), 'utf8');
      output = JSON.parse(raw) as JscpdOutput;
    } catch {
      throw new Error('jscpd wrote no readable report, is it installed?');
    }

    const total = output.statistics.total;

    return {
      // copy fields one by one so the source code itself isn't kept
      duplicates: output.duplicates.map((clone) => ({
        format: clone.format,
        lines: clone.lines,
        tokens: clone.tokens,
        firstFile: place(clone.firstFile),
        secondFile: place(clone.secondFile),
      })),
      totalLines: total.lines,
      duplicatedLines: total.duplicatedLines,
      percentage: total.percentage,
    };
  } finally {
    await rm(reportDir, { recursive: true, force: true });
  }
}
