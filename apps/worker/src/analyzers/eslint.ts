import { execFile } from 'child_process';
import { relative, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

// 2 min per analyzer
const timeoutMs = 120_000;
// big repos go past the 1 MB default
const maxBuffer = 32 * 1024 * 1024;

const configPath = resolve(__dirname, '../../eslint-analysis.config.mjs');
// resolve via the package so workspace hoisting doesn't break it
const eslintBin = resolve(require.resolve('eslint/package.json'), '../bin/eslint.js');

export interface EslintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  fatal?: boolean;
}

export interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
}

export interface EslintReport {
  results: EslintFileResult[];
  errorCount: number;
  warningCount: number;
}

export async function runEslint(repoPath: string): Promise<EslintReport> {
  // ignore the repo's own config. cwd is the repo so ignore patterns work
  const args = ['--no-config-lookup', '--config', configPath, '--format', 'json', '.'];

  let stdout: string;

  try {
    ({ stdout } = await run(process.execPath, [eslintBin, ...args], {
      cwd: repoPath,
      timeout: timeoutMs,
      maxBuffer,
    }));
  } catch (err) {
    // exit 1 just means it found problems
    const failed = err as { code?: number; stdout?: string };
    if (failed.code !== 1 || !failed.stdout) throw err;
    stdout = failed.stdout;
  }

  const files = JSON.parse(stdout) as EslintFileResult[];

  const results: EslintFileResult[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const file of files) {
    // skip clean files
    if (!file.messages.length) continue;

    for (const message of file.messages) {
      if (message.severity === 2) errorCount++;
      else warningCount++;
    }

    // make paths relative to the repo
    results.push({ filePath: relative(repoPath, file.filePath), messages: file.messages });
  }

  return { results, errorCount, warningCount };
}
