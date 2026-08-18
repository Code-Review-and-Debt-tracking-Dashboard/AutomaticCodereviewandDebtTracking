import { readdir } from 'fs/promises';
import { extname, join } from 'path';

import { logger } from '../lib/logger';

export type Language = 'javascript' | 'python' | 'java' | 'cpp';

export type Analyzer =
  | 'eslint'
  | 'pylint'
  | 'bandit'
  | 'radon'
  | 'checkstyle'
  | 'pmd'
  | 'cppcheck'
  | 'jscpd';

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
  // .h could be C or C++, but cppcheck handles both so one bucket is enough.
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

// Same directories the analyzers themselves ignore. Counting them would let a
// vendored node_modules turn a Python repo into a JavaScript one.
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

async function countByLanguage(dir: string, counts: Map<Language, number>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // isDirectory() is false for symlinks, so this can't loop.
      if (!skipDirs.has(entry.name)) {
        await countByLanguage(join(dir, entry.name), counts);
      }
      continue;
    }

    if (isGenerated(entry.name)) continue;

    const language = extensions[extname(entry.name).toLowerCase()];
    if (language) {
      counts.set(language, (counts.get(language) || 0) + 1);
    }
  }
}

/**
 * Walks the cloned checkout and works out which languages are in it and which
 * analyzers should run over it. A repo can hold more than one language, so the
 * analyzer set is the union of everything found — primary is only for display.
 */
export async function detectLanguages(repoPath: string) {
  const counts = new Map<Language, number>();
  await countByLanguage(repoPath, counts);

  const languages = [...counts.entries()]
    .map(([language, fileCount]) => ({ language, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount);

  const primary = languages.length ? languages[0].language : null;

  // jscpd looks for duplication regardless of language, so it runs whenever
  // there is anything to analyse at all.
  const analyzers = languages.length
    ? [...new Set(languages.flatMap((l) => analyzersFor[l.language])), 'jscpd' as Analyzer]
    : [];

  logger.info({ primary, languages, analyzers }, 'Languages detected');
  return { languages, primary, analyzers };
}
