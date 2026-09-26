import { readdir, readFile } from 'fs/promises';
import { extname, join, relative } from 'path';

export type TodoMarker = 'TODO' | 'FIXME' | 'HACK' | 'XXX';

export interface TodoMatch {
  file: string;
  line: number;
  marker: TodoMarker;
  text: string;
}

export interface TodoScanReport {
  matches: TodoMatch[];
  counts: Record<TodoMarker, number>;
}

// only uppercase markers at the start of a comment
const markerPattern = /^\s*(?:\/\/|#|\/\*+|\*|<!--|--)\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*)$/;

const maxTextLength = 200;

// vendored, generated and virtualenv code
const ignoredDirs = new Set([
  '.git',
  '.venv',
  'venv',
  'env',
  '__pycache__',
  'site-packages',
  'node_modules',
  'build',
  'dist',
  'migrations',
]);

const sourceExtensions = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.py',
  '.pyi',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.cxx',
  '.hpp',
  '.hh',
]);

function isGenerated(name: string): boolean {
  return name.endsWith('.min.js') || name.endsWith('.bundle.js');
}

export function scanSource(text: string): Omit<TodoMatch, 'file'>[] {
  const found: Omit<TodoMatch, 'file'>[] = [];

  // handle CRLF files
  text.split(/\r?\n/).forEach((line, index) => {
    const match = markerPattern.exec(line);
    if (!match) return;

    // strip */ or --> at the end
    const body = match[2].replace(/\*\/\s*$|-->\s*$/, '').trim();

    found.push({
      line: index + 1,
      marker: match[1] as TodoMarker,
      text: body.length > maxTextLength ? `${body.slice(0, maxTextLength)}…` : body,
    });
  });

  return found;
}

async function walk(root: string, dir: string, matches: TodoMatch[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      // symlinks aren't followed so no loops
      if (!ignoredDirs.has(entry.name)) await walk(root, path, matches);
      continue;
    }

    if (isGenerated(entry.name) || !sourceExtensions.has(extname(entry.name).toLowerCase())) {
      continue;
    }

    // forward slashes on every platform
    const file = relative(root, path).split('\\').join('/');
    const text = await readFile(path, 'utf8');

    for (const found of scanSource(text)) matches.push({ file, ...found });
  }
}

// finds TODO / FIXME / HACK / XXX comments
export async function runTodoScan(repoPath: string): Promise<TodoScanReport> {
  const matches: TodoMatch[] = [];
  await walk(repoPath, repoPath, matches);

  const counts: Record<TodoMarker, number> = { TODO: 0, FIXME: 0, HACK: 0, XXX: 0 };
  for (const match of matches) counts[match.marker] += 1;

  return { matches, counts };
}
