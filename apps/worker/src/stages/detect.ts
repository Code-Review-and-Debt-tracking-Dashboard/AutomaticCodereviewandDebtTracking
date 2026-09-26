import { readdir, readFile } from 'fs/promises';
import { extname, join } from 'path';

import { logger } from '../lib/logger';
import { isTestDir, isTestFile } from '../lib/testCode';

export type Language = 'javascript' | 'python' | 'java' | 'cpp';

export type Analyzer =
  | 'eslint'
  | 'pylint'
  | 'bandit'
  | 'radon'
  | 'checkstyle'
  | 'pmd'
  | 'cppcheck'
  | 'jscpd'
  | 'todo-scan';

const extensions: Record<string, Language> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'javascript',
  '.tsx': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.java': 'java',
  // cppcheck handles both C and C++
  '.c': 'cpp',
  '.h': 'cpp',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
};

const analyzersFor: Record<Language, Analyzer[]> = {
  javascript: ['eslint'],
  python: ['pylint', 'bandit', 'radon'],
  java: ['checkstyle', 'pmd'],
  cpp: ['cppcheck'],
};

// same dirs the analyzers ignore
const skipDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.expo',
  'coverage',
]);

function isGenerated(name: string): boolean {
  return name.endsWith('.min.js') || name.endsWith('.bundle.js');
}

// skips blank lines
async function countLines(path: string): Promise<number> {
  const text = await readFile(path, 'utf8');
  return text.split('\n').filter((line) => line.trim()).length;
}

async function countByLanguage(
  dir: string,
  counts: Map<Language, number>,
  totals: { lines: number },
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // symlinks aren't followed, test dirs aren't counted
      if (!skipDirs.has(entry.name) && !isTestDir(entry.name)) {
        await countByLanguage(join(dir, entry.name), counts, totals);
      }
      continue;
    }

    if (isGenerated(entry.name) || isTestFile(entry.name)) continue;

    const language = extensions[extname(entry.name).toLowerCase()];
    if (language) {
      counts.set(language, (counts.get(language) || 0) + 1);
      totals.lines += await countLines(join(dir, entry.name));
    }
  }
}

// finds languages, which analyzers to run, and lines of code
export async function detectLanguages(repoPath: string) {
  const counts = new Map<Language, number>();
  const totals = { lines: 0 };
  await countByLanguage(repoPath, counts, totals);

  const languages = [...counts.entries()]
    .map(([language, fileCount]) => ({ language, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount);

  const primary = languages.length ? languages[0].language : null;

  // jscpd and todo scan run for any language
  const analyzers: Analyzer[] = languages.length
    ? [...new Set(languages.flatMap((l) => analyzersFor[l.language])), 'jscpd', 'todo-scan']
    : [];

  logger.info({ primary, languages, analyzers, linesOfCode: totals.lines }, 'Languages detected');
  return { languages, primary, analyzers, linesOfCode: totals.lines };
}
