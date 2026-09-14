import { AnalysisStatus, prisma } from '@codehealth/db';
import type { AnalysisJobData } from '@codehealth/shared';
import type { Job } from 'bullmq';

import { runEslint } from '../analyzers/eslint';
import { runJscpd } from '../analyzers/jscpd';
import { runBandit } from '../analyzers/bandit';
import { runPylint } from '../analyzers/pylint';
import { runRadon } from '../analyzers/radon';
import { logger } from '../lib/logger';
import { cleanupWorkspace, cloneRepository, createWorkspace } from '../stages/clone';
import { computeDebtDelta } from '../stages/debt';
import { detectLanguages } from '../stages/detect';
import { evaluateGate } from '../stages/gate';
import { matchFindings } from '../stages/match';
import { type AnalyzerReports, normalize } from '../stages/normalize';
import { computeScore } from '../stages/score';

/**
 * Runs one analyzer and keeps its failure to itself. A tool that falls over on a
 * repo it can't handle should cost us that tool's findings, not the whole
 * analysis — the rest still runs and the score is computed from what came back.
 */
async function runAnalyzer<T>(
  analyzer: string,
  analysisId: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    logger.error({ analysisId, analyzer, err }, 'Analyzer failed');
    return undefined;
  }
}

/**
 * Consumes one analysis job. Clones the repo, works out what's in it, runs the
 * analyzers over it, flattens their output into findings, scores them and runs
 * them past the repo's quality gate — the comment and persist stages are added
 * on top of this in later tasks.
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

    const reports: AnalyzerReports = {};

    if (detected.analyzers.includes('eslint')) {
      reports.eslint = await runAnalyzer('eslint', analysisId, async () => {
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
        return eslint;
      });
    }

    if (detected.analyzers.includes('pylint')) {
      reports.pylint = await runAnalyzer('pylint', analysisId, async () => {
        const pylint = await runPylint(cloned.repoPath);
        logger.info(
          { analysisId, messages: pylint.messages.length, counts: pylint.counts },
          'PyLint finished',
        );
        return pylint;
      });
    }

    if (detected.analyzers.includes('bandit')) {
      reports.bandit = await runAnalyzer('bandit', analysisId, async () => {
        const bandit = await runBandit(cloned.repoPath);
        logger.info(
          {
            analysisId,
            results: bandit.results.length,
            counts: bandit.counts,
            nosec: bandit.nosec,
          },
          'Bandit finished',
        );
        return bandit;
      });
    }

    if (detected.analyzers.includes('radon')) {
      reports.radon = await runAnalyzer('radon', analysisId, async () => {
        const radon = await runRadon(cloned.repoPath);
        logger.info(
          {
            analysisId,
            blocks: radon.blocks.length,
            files: radon.maintainability.length,
            counts: radon.counts,
            miCounts: radon.miCounts,
          },
          'Radon finished',
        );
        return radon;
      });
    }

    if (detected.analyzers.includes('jscpd')) {
      reports.jscpd = await runAnalyzer('jscpd', analysisId, async () => {
        const jscpd = await runJscpd(cloned.repoPath);
        logger.info(
          { analysisId, duplicates: jscpd.duplicates.length, percentage: jscpd.percentage },
          'jscpd finished',
        );
        return jscpd;
      });
    }

    const { findings, duplicationPct } = normalize(reports);

    logger.info(
      {
        analysisId,
        findings: findings.length,
        duplicationPct,
        linesOfCode: detected.linesOfCode,
      },
      'Findings normalized',
    );

    // No baseline source yet, so everything comes back NEW.
    const matched = matchFindings({ findings, baseline: null });

    logger.info(
      {
        analysisId,
        new: matched.findings.filter((f) => f.state === 'NEW').length,
        existing: matched.findings.filter((f) => f.state === 'EXISTING').length,
        resolved: matched.resolved.length,
      },
      'Findings matched',
    );

    const score = computeScore({
      findings: matched.findings,
      duplicationPct,
      linesOfCode: detected.linesOfCode,
    });

    // Same missing baseline as the matcher above, so there is no delta yet.
    const debtDeltaMinutes = computeDebtDelta({
      currentDebtMinutes: score.debtMinutes,
      baseline: null,
    });

    logger.info(
      {
        analysisId,
        healthScore: score.healthScore,
        debtMinutes: score.debtMinutes,
        debtDeltaMinutes,
        ...score.penaltyBreakdown,
      },
      'Score computed',
    );

    const gate = await prisma.qualityGate.findUnique({ where: { repoId } });

    const gateEvaluation = evaluateGate({ gate, score });

    logger.info(
      {
        analysisId,
        gateResult: gateEvaluation.result,
        blockPR: gateEvaluation.blockPR,
        breached: gateEvaluation.metrics.filter((m) => !m.passed).length,
        checked: gateEvaluation.metrics.length,
      },
      'Quality gate evaluated',
    );

    // remaining analysis stages go here, over findings and score

    await prisma.analysisJob.update({
      where: { id: analysisId },
      data: { status: AnalysisStatus.COMPLETED, progress: 100, completedAt: new Date() },
    });
  } finally {
    await cleanupWorkspace(workspace);
  }
}
