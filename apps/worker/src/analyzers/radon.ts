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

// radon gives either the metrics or an error per file
interface Unreadable {
  error: string;
}

type CcBlock = Omit<RadonBlock, 'file' | 'classname'> & { classname?: string };
type CcEntry = CcBlock[] | Unreadable;
type MiEntry = { mi: number; rank: RadonMiRank } | Unreadable;

async function radon<T>(repoPath: string, command: 'cc' | 'mi'): Promise<Record<string, T>> {
  // run inside the repo so paths stay relative
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
    // parse errors still exit 0, so this is radon itself crashing
    const failed = err as { stdout?: string; stderr?: string };
    stdout = failed.stdout ?? '';
    stderr = failed.stderr ?? '';
  }

  // bad JSON means radon didn't run properly
  try {
    return JSON.parse(stdout) as Record<string, T>;
  } catch {
    throw new Error(
      `radon ${command} produced no readable output, is it installed? ${stderr.trim()}`,
    );
  }
}

// complexity + maintainability index
export async function runRadon(repoPath: string): Promise<RadonReport> {
  const [cc, mi] = await Promise.all([
    radon<CcEntry>(repoPath, 'cc'),
    radon<MiEntry>(repoPath, 'mi'),
  ]);

  const blocks: RadonBlock[] = [];
  const maintainability: RadonFileMi[] = [];
  const counts: Record<RadonRank, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const miCounts: Record<RadonMiRank, number> = { A: 0, B: 0, C: 0 };
  // both commands report the same bad file, keep one
  const failures = new Map<string, string>();

  for (const [file, entry] of Object.entries(cc)) {
    if (!Array.isArray(entry)) {
      failures.set(file, entry.error);
      continue;
    }

    // methods are listed again at top level, so skip the nested ones
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
