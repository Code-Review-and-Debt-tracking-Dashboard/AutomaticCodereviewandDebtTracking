import { AnalysisStatus, prisma } from '@codehealth/db';
import type { AnalysisJobData } from '@codehealth/shared';
import type { Job } from 'bullmq';

import { runEslint } from '../analyzers/eslint';
import { runPylint } from '../analyzers/pylint';
import { logger } from '../lib/logger';
import { cleanupWorkspace, cloneRepository, createWorkspace } from '../stages/clone';
import { detectLanguages } from '../stages/detect';

/**
 * Runs one analyzer and keeps its failure to itself. A tool that falls over on a
 * repo it can't handle should cost us that tool's findings, not the whole
 * analysis — the rest still runs and the score is computed from what came back.
 */
async function runAnalyzer(analyzer: string, analysisId: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    logger.error({ analysisId, analyzer, err }, 'Analyzer failed');
  }
}

/**
 * Consumes one analysis job. Clones the repo, works out what's in it, and moves
 * the AnalysisJob row through its lifecycle — the normalize, score, gate,
 * comment and persist stages are added on top of this in later tasks.
 *
 * Only the analyzers are allowed to fail quietly. Everything else throws on
 * purpose: that's how BullMQ is told to retry, and the worker's 'failed'
 * listener is what marks the row FAILED. The temp directory is still removed on
 * that path, because it's in a finally.
 */
export async function analysisProcessor(job: Job<AnalysisJobData>) {
  const { analysisId, repoId, branch, commitSha } = job.data;

  await prisma.analysisJob.update({
    where: { id: analysisId },
    data: { status: AnalysisStatus.RUNNING, startedAt: new Date() },
  });

  logger.info({ jobId: job.id, analysisId, repoId, branch, commitSha }, 'Analysis started');

  const workspace = await createWorkspace();

  try {
    const cloned = await cloneRepository(job.data, workspace);

    // Manual runs are queued with a placeholder sha, so record the real one.
    await prisma.analysisJob.update({
      where: { id: analysisId },
      data: { commitSha: cloned.commitSha, progress: 10 },
    });

    const detected = await detectLanguages(cloned.repoPath);

    await prisma.analysisJob.update({
      where: { id: analysisId },
      data: { progress: 15 },
    });

    if (detected.analyzers.includes('eslint')) {
      await runAnalyzer('eslint', analysisId, async () => {
        const eslint = await runEslint(cloned.repoPath);
        logger.info(
          {
            analysisId,
            files: eslint.results.length,
            errors: eslint.errorCount,
            warnings: eslint.warningCount,
          },
          'ESLint finished',
        );
      });
    }

    if (detected.analyzers.includes('pylint')) {
      await runAnalyzer('pylint', analysisId, async () => {
        const pylint = await runPylint(cloned.repoPath);
        logger.info(
          { analysisId, messages: pylint.messages.length, counts: pylint.counts },
          'PyLint finished',
        );
      });
    }

    // remaining analysis stages go here, over cloned.repoPath

    await prisma.analysisJob.update({
      where: { id: analysisId },
      data: { status: AnalysisStatus.COMPLETED, progress: 100, completedAt: new Date() },
    });
  } finally {
    await cleanupWorkspace(workspace);
  }
}
