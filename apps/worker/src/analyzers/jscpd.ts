import { execFile } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

// The pipeline allows each analyzer two minutes.
const timeoutMs = 120_000;
// A big repo's report goes well past the 1 MB default.
const maxBuffer = 32 * 1024 * 1024;

// Going through the package entry survives npm's workspace hoisting, which a
// hardcoded node_modules/.bin path doesn't.
const jscpdBin = resolve(require.resolve('jscpd/package.json'), '../run-jscpd.js');

// Same list the other analyzers ignore: vendored, generated and virtualenv code
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

// These are file globs, not directory names, so the wildcards are what catch the
// directory at any depth.
const ignores = ignoredDirs.map((dir) => `**/${dir}/**`).join(',');

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

/**
 * Looks for copy-pasted blocks across a cloned checkout and hands back jscpd's
 * output as it came. Turning it into findings is the normalize stage's job.
 */
export async function runJscpd(repoPath: string): Promise<JscpdReport> {
  // The json reporter writes a file and prints nothing, so it needs somewhere of
  // its own to write to — the repo is being analysed and must not be touched.
  const reportDir = await mkdtemp(join(tmpdir(), 'codehealth-jscpd-'));

  try {
    // Run from inside the repo so the temp workspace name never reaches the
    // paths, the way the other analyzers do it.
    const args = ['.', '--reporters', 'json', '--output', reportDir, '--ignore', ignores];

    // No --threshold or --exit-code, so finding duplicates still exits 0 and any
    // non-zero exit here is a real failure.
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
      // Copied field by field: the raw entries also carry the duplicated source
      // itself, and nothing downstream is allowed to hold source code.
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
