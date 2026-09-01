import { execFile } from 'child_process';
import { resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

// The pipeline allows each analyzer two minutes.
const timeoutMs = 120_000;
// A big repo's report goes well past the 1 MB default.
const maxBuffer = 32 * 1024 * 1024;

// Pylint's exit status is a bitmask of what it found, not a plain code. This bit
// is the only one that means the run itself went wrong.
const usageError = 32;

const configPath = resolve(__dirname, '../../pylint-analysis.rc');

export type PylintMessageType =
  | 'fatal'
  | 'error'
  | 'warning'
  | 'refactor'
  | 'convention'
  | 'information';

export interface PylintMessage {
  type: PylintMessageType;
  module: string;
  obj: string;
  line: number;
  column: number;
  endLine: number | null;
  endColumn: number | null;
  path: string;
  symbol: string;
  message: string;
  'message-id': string;
}

export interface PylintReport {
  messages: PylintMessage[];
  counts: Record<PylintMessageType, number>;
}

/**
 * Lints a cloned checkout with the worker's own config and hands back pylint's
 * output as it came. Turning it into findings is the normalize stage's job.
 */
export async function runPylint(repoPath: string): Promise<PylintReport> {
  // --rcfile keeps the scanned repo's own pylintrc out of it. --recursive is
  // needed because otherwise pylint only accepts packages, not a source tree.
  const args = [
    '-m',
    'pylint',
    '--rcfile',
    configPath,
    '--output-format',
    'json',
    '--recursive',
    'y',
    '.',
  ];

  let stdout: string;
  let stderr: string;

  try {
    ({ stdout, stderr } = await run('python3', args, {
      cwd: repoPath,
      timeout: timeoutMs,
      maxBuffer,
    }));
  } catch (err) {
    // Any message pylint reports sets a bit, so a normal run with findings comes
    // back non-zero. Only the usage bit means it couldn't do its job.
    const failed = err as { code?: number; stdout?: string; stderr?: string };
    if (typeof failed.code !== 'number' || failed.code & usageError) throw err;
    stdout = failed.stdout ?? '';
    stderr = failed.stderr ?? '';
  }

  // Parsing is the real check that pylint ran — a crash or a missing pylint
  // leaves something that isn't JSON, and that has to surface rather than read
  // as a clean repo.
  let messages: PylintMessage[];
  try {
    messages = JSON.parse(stdout) as PylintMessage[];
  } catch {
    throw new Error(`pylint produced no readable output, is it installed? ${stderr.trim()}`);
  }

  const counts: Record<PylintMessageType, number> = {
    fatal: 0,
    error: 0,
    warning: 0,
    refactor: 0,
    convention: 0,
    information: 0,
  };

  for (const message of messages) {
    counts[message.type]++;
  }

  return { messages, counts };
}
