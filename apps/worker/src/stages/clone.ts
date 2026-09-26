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

// GIT_TERMINAL_PROMPT=0 matters: without it a missing or rejected token makes
// git block on an interactive credential prompt nobody is there to answer.
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

// git repeats the remote URL back in its error text, so without this the token
// would land in the logs and in AnalysisJob.errorMessage.
function redact(message: string, token: string | null): string {
  return token ? message.split(token).join('***') : message;
}

// Separate from cloneRepository so the caller holds the path before anything
// can throw, and can always remove it afterwards.
export function createWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'codehealth-'));
}

export function cleanupWorkspace(dir: string): Promise<void> {
  return rm(dir, { recursive: true, force: true });
}

/**
 * Shallow-clones the job's branch into the workspace and reports the commit it
 * actually landed on. That sha is the one the analysis belongs to — the job's
 * own commitSha is only a placeholder for manually triggered runs.
 */
export async function cloneRepository(job: AnalysisJobData, workspace: string) {
  const { repoId, branch, cloneUrl } = job;
  const repoPath = join(workspace, 'repo');

  const token = await tokenForRepo(repoId);
  if (!token) {
    logger.warn({ repoId }, 'No stored GitHub token for repo owner, cloning anonymously');
  }

  // The token travels in the clone URL, which means it is visible in this
  // process's argv while git runs. Never log the URL itself.
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
