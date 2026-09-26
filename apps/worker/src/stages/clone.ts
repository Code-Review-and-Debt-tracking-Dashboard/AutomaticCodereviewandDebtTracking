import { execFile } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { prisma } from '@codehealth/db';
import type { AnalysisJobData } from '@codehealth/shared';

import { env } from '../config/env';
import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';

const run = promisify(execFile);

// stop git hanging on a password prompt
const gitOptions = {
  timeout: env.cloneTimeoutMs,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
};

async function tokenForRepo(repoId: string): Promise<string | null> {
  const repo = await prisma.repository.findUnique({
    where: { id: repoId },
    select: {
      owner: { select: { githubCredential: { select: { encryptedAccessToken: true } } } },
    },
  });

  const encrypted = repo?.owner.githubCredential?.encryptedAccessToken;
  return encrypted ? decrypt(encrypted) : null;
}

// keep the token out of logs and error messages
function redact(message: string, token: string | null): string {
  return token ? message.split(token).join('***') : message;
}

// separate so the caller can always clean it up
export function createWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'codehealth-'));
}

export function cleanupWorkspace(dir: string): Promise<void> {
  return rm(dir, { recursive: true, force: true });
}

// shallow clone, returns the sha it actually checked out
export async function cloneRepository(job: AnalysisJobData, workspace: string) {
  const { repoId, branch, cloneUrl } = job;
  const repoPath = join(workspace, 'repo');

  const token = await tokenForRepo(repoId);
  if (!token) {
    logger.warn({ repoId }, 'No stored GitHub token for repo owner, cloning anonymously');
  }

  // url has the token in it, never log it
  const url = new URL(cloneUrl);
  if (token) {
    url.username = 'x-access-token';
    url.password = token;
  }

  try {
    await run('git', ['clone', '--depth=1', '--branch', branch, url.toString(), repoPath], gitOptions);
  } catch (err) {
    throw new Error(redact((err as Error).message, token));
  }

  const { stdout } = await run('git', ['-C', repoPath, 'rev-parse', 'HEAD'], gitOptions);
  const commitSha = stdout.trim();

  logger.info({ repoId, branch, commitSha }, 'Repository cloned');
  return { repoPath, commitSha };
}
