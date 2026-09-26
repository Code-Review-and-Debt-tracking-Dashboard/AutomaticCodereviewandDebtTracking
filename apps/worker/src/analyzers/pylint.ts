import { execFile } from 'child_process';
import { resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

// 2 min per analyzer
const timeoutMs = 120_000;
// big repos go past the 1 MB default
const maxBuffer = 32 * 1024 * 1024;

// exit code is a bitmask, only this bit means the run failed
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

export async function runPylint(repoPath: string): Promise<PylintReport> {
  // use our own rcfile, --recursive so it takes a plain folder
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
    const failed = err as { code?: number; stdout?: string; stderr?: string };
    if (typeof failed.code !== 'number' || failed.code & usageError) throw err;
    stdout = failed.stdout ?? '';
    stderr = failed.stderr ?? '';
  }

  // bad JSON means pylint didn't run properly
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
