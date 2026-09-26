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

// radon matches these against directory names at any depth, so unlike bandit's
// excludes they don't need wildcards around them.
const ignores = ignoredDirs.join(',');

export type RadonRank = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type RadonMiRank = 'A' | 'B' | 'C';

export interface RadonBlock {
  file: string;
  type: 'function' | 'method' | 'class';
  name: string;
  classname: string | null;
  complexity: number;
  rank: RadonRank;
  lineno: number;
  endline: number;
  col_offset: number;
}

export interface RadonFileMi {
  file: string;
  mi: number;
  rank: RadonMiRank;
}

export interface RadonError {
  file: string;
  reason: string;
}

export interface RadonReport {
  blocks: RadonBlock[];
  maintainability: RadonFileMi[];
  errors: RadonError[];
  counts: Record<RadonRank, number>;
  miCounts: Record<RadonMiRank, number>;
}

// Under each filename radon puts either the metrics or a note saying it couldn't
// read the file. classname is only there on methods.
interface Unreadable {
  error: string;
}

type CcBlock = Omit<RadonBlock, 'file' | 'classname'> & { classname?: string };
type CcEntry = CcBlock[] | Unreadable;
type MiEntry = { mi: number; rank: RadonMiRank } | Unreadable;

async function radon<T>(repoPath: string, command: 'cc' | 'mi'): Promise<Record<string, T>> {
  // Run from inside the repo so the temp workspace name never reaches the
  // paths, the way the other analyzers do it.
  const args = ['-m', 'radon', command, '.', '-j', '-i', ignores];

  let stdout = '';
  let stderr = '';

  try {
    ({ stdout, stderr } = await run('python3', args, {
      cwd: repoPath,
      timeout: timeoutMs,
      maxBuffer,
    }));
  } catch (err) {
    // radon still exits 0 for a file it couldn't parse — that comes back as an
    // error entry on stdout — so a non-zero exit means radon itself fell over.
    const failed = err as { stdout?: string; stderr?: string };
    stdout = failed.stdout ?? '';
    stderr = failed.stderr ?? '';
  }

  // Parsing is the real check that radon ran — a crash or a missing radon
  // leaves something that isn't JSON, and that has to surface rather than read
  // as a clean repo.
  try {
    return JSON.parse(stdout) as Record<string, T>;
  } catch {
    throw new Error(
      `radon ${command} produced no readable output, is it installed? ${stderr.trim()}`,
    );
  }
}

/**
 * Measures a cloned checkout's cyclomatic complexity and maintainability index
 * and hands back radon's output as it came. Turning it into findings is the
 * normalize stage's job.
 */
export async function runRadon(repoPath: string): Promise<RadonReport> {
  // Two separate commands, so they share the one analyzer's time budget.
  const [cc, mi] = await Promise.all([
    radon<CcEntry>(repoPath, 'cc'),
    radon<MiEntry>(repoPath, 'mi'),
  ]);

  const blocks: RadonBlock[] = [];
  const maintainability: RadonFileMi[] = [];
  const counts: Record<RadonRank, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const miCounts: Record<RadonMiRank, number> = { A: 0, B: 0, C: 0 };
  // A file radon can't read is reported by both commands, so keep one row of it.
  const failures = new Map<string, string>();

  for (const [file, entry] of Object.entries(cc)) {
    if (!Array.isArray(entry)) {
      failures.set(file, entry.error);
      continue;
    }

    // A class also lists its methods, and radon repeats those at the top level
    // anyway, so only the named fields are copied and the nested copy is left.
    for (const block of entry) {
      counts[block.rank]++;
      blocks.push({
        file,
        type: block.type,
        name: block.name,
        classname: block.classname ?? null,
        complexity: block.complexity,
        rank: block.rank,
        lineno: block.lineno,
        endline: block.endline,
        col_offset: block.col_offset,
      });
    }
  }

  for (const [file, entry] of Object.entries(mi)) {
    if ('error' in entry) {
      failures.set(file, entry.error);
      continue;
    }

    miCounts[entry.rank]++;
    maintainability.push({ file, mi: entry.mi, rank: entry.rank });
  }

  const errors = [...failures].map(([file, reason]) => ({ file, reason }));

  return { blocks, maintainability, errors, counts, miCounts };
}
