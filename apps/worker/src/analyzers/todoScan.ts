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

// Only a marker that opens a comment counts. Uppercase only, so a "todo list"
// in a string or a sentence in a docblock doesn't turn into debt.
const markerPattern = /^\s*(?:\/\/|#|\/\*+|\*|<!--|--)\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*)$/;

// The message becomes a database row, so a wall of text after the marker is
// cut short.
const maxTextLength = 200;

// Same list the other analyzers ignore: vendored, generated and virtualenv code
// isn't the author's work, and scanning it buries whatever they did write.
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

/**
 * Finds every debt marker in one file's text. Pure so the regex can be tested
 * without touching the disk.
 */
export function scanSource(text: string): Omit<TodoMatch, 'file'>[] {
  const found: Omit<TodoMatch, 'file'>[] = [];

  // A regex `.` stops at \r, so a CRLF file would never match otherwise.
  text.split(/\r?\n/).forEach((line, index) => {
    const match = markerPattern.exec(line);
    if (!match) return;

    // A block comment closer on the same line is noise, not the author's note.
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
      // isDirectory() is false for symlinks, so this can't loop.
      if (!ignoredDirs.has(entry.name)) await walk(root, path, matches);
      continue;
    }

    if (isGenerated(entry.name) || !sourceExtensions.has(extname(entry.name).toLowerCase())) {
      continue;
    }

    // Forward slashes so the path reads the same as the CLI tools' output on
    // every platform.
    const file = relative(root, path).split('\\').join('/');
    const text = await readFile(path, 'utf8');

    for (const found of scanSource(text)) matches.push({ file, ...found });
  }
}

/**
 * Walks a cloned checkout for TODO, FIXME, HACK and XXX comments. These are the
 * debt the authors already admitted to, which no linter reports. Turning them
 * into findings is the normalize stage's job.
 */
export async function runTodoScan(repoPath: string): Promise<TodoScanReport> {
  const matches: TodoMatch[] = [];
  await walk(repoPath, repoPath, matches);

  const counts: Record<TodoMarker, number> = { TODO: 0, FIXME: 0, HACK: 0, XXX: 0 };
  for (const match of matches) counts[match.marker] += 1;

  return { matches, counts };
}
