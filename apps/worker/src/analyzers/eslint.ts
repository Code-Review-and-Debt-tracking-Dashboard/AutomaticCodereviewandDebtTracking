import { execFile } from 'child_process';
import { relative, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

// The pipeline allows each analyzer two minutes.
const timeoutMs = 120_000;
// A big repo's report goes well past the 1 MB default.
const maxBuffer = 32 * 1024 * 1024;

const configPath = resolve(__dirname, '../../eslint-analysis.config.mjs');
// Going through the package entry survives npm's workspace hoisting, which a
// hardcoded node_modules/.bin path doesn't.
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

/**
 * Lints a cloned checkout with the worker's own config and hands back eslint's
 * output as it came. Turning it into findings is the normalize stage's job.
 */
export async function runEslint(repoPath: string): Promise<EslintReport> {
  // --no-config-lookup keeps the scanned repo's own config out of it, and the
  // cwd is the repo because --config makes the ignore patterns cwd-relative.
  const args = ['--no-config-lookup', '--config', configPath, '--format', 'json', '.'];

  let stdout: string;

  try {
    ({ stdout } = await run(process.execPath, [eslintBin, ...args], {
      cwd: repoPath,
      timeout: timeoutMs,
      maxBuffer,
    }));
  } catch (err) {
    // Exit 1 just means it found problems and the report is still on stdout.
    // Anything else — a broken config, or a timeout kill — is a real failure.
    const failed = err as { code?: number; stdout?: string };
    if (failed.code !== 1 || !failed.stdout) throw err;
    stdout = failed.stdout;
  }

  const files = JSON.parse(stdout) as EslintFileResult[];

  const results: EslintFileResult[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const file of files) {
    // eslint lists every file it looked at, and most of them are clean.
    if (!file.messages.length) continue;

    for (const message of file.messages) {
      if (message.severity === 2) errorCount++;
      else warningCount++;
    }

    // Paths come back absolute, so the temp workspace name would otherwise land
    // in the findings and change on every run.
    results.push({ filePath: relative(repoPath, file.filePath), messages: file.messages });
  }

  return { results, errorCount, warningCount };
}
