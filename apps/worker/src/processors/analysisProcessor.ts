import type {
  AnalysisFinding,
  AnalysisJobData,
  AnalysisResultsPayload,
  AnalysisStage,
  GateResult,
} from '@codehealth/shared';
import type { Job } from 'bullmq';

import { runEslint } from '../analyzers/eslint';
import { runJscpd } from '../analyzers/jscpd';
import { runPmd } from '../analyzers/pmd';
import { runBandit } from '../analyzers/bandit';
import { runCheckstyle } from '../analyzers/checkstyle';
import { runCppcheck } from '../analyzers/cppcheck';
import { runPylint } from '../analyzers/pylint';
import { runRadon } from '../analyzers/radon';
import { runTodoScan } from '../analyzers/todoScan';
import { fetchBaseline, fetchQualityGate, postResults, startJob } from '../lib/apiClient';
import { logger } from '../lib/logger';
import { cleanupWorkspace, cloneRepository, createWorkspace } from '../stages/clone';
import { buildPrComment } from '../stages/comment';
import { computeDebtDelta } from '../stages/debt';
import { detectLanguages } from '../stages/detect';
import { DEFAULT_GATE, evaluateGate } from '../stages/gate';
import { matchFindings } from '../stages/match';
import { type AnalyzerReports, normalize } from '../stages/normalize';
import { postPrComment } from '../stages/postComment';
import { postCommitStatus } from '../stages/postStatus';
import { type ScoreResult, computeScore } from '../stages/score';

export function buildResultsPayload(input: {
  analysisId: string;
  commitSha: string;
  findings: AnalysisFinding[];
  score: ScoreResult;
  debtDeltaMinutes: number;
  gateResult: GateResult;
  linesOfCode: number;
  analysisLimited: boolean;
}): AnalysisResultsPayload {
  const { penaltyBreakdown: _penaltyBreakdown, ...metrics } = input.score;

  return {
    analysisId: input.analysisId,
    commitSha: input.commitSha,
    metrics: {
      ...metrics,
      debtDeltaMinutes: input.debtDeltaMinutes,
      linesOfCode: input.linesOfCode,
      gateResult: input.gateResult,
    },
    findings: input.findings,
    // Nothing captures analyzer versions yet.
    toolVersions: {},
    analysisLimited: input.analysisLimited,
  };
}

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

export async function analysisProcessor(job: Job<AnalysisJobData>) {
  const { analysisId, repoId, branch, commitSha } = job.data;

  await startJob(analysisId);

  logger.info({ jobId: job.id, analysisId, repoId, branch, commitSha }, 'Analysis started');

  let stage: AnalysisStage = 'clone';
  const workspace = await createWorkspace();

  try {
    // Manual runs are queued with a placeholder sha. The one that comes back
    // here is what was actually checked out, and it travels with the results.
    const cloned = await cloneRepository(job.data, workspace);

    stage = 'detect';
    const detected = await detectLanguages(cloned.repoPath);

    stage = 'analyze';
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

    if (detected.analyzers.includes('checkstyle')) {
      reports.checkstyle = await runAnalyzer('checkstyle', analysisId, async () => {
        const checkstyle = await runCheckstyle(cloned.repoPath);
        logger.info(
          {
            analysisId,
            violations: checkstyle.violations.length,
            counts: checkstyle.counts,
            unparsed: checkstyle.errors.length,
          },
          'Checkstyle finished',
        );
        return checkstyle;
      });
    }

    if (detected.analyzers.includes('pmd')) {
      reports.pmd = await runAnalyzer('pmd', analysisId, async () => {
        const pmd = await runPmd(cloned.repoPath);
        logger.info(
          {
            analysisId,
            violations: pmd.violations.length,
            counts: pmd.counts,
            unparsed: pmd.errors.length,
          },
          'PMD finished',
        );
        return pmd;
      });
    }

    if (detected.analyzers.includes('cppcheck')) {
      reports.cppcheck = await runAnalyzer('cppcheck', analysisId, async () => {
        const cppcheck = await runCppcheck(cloned.repoPath);
        logger.info(
          {
            analysisId,
            findings: cppcheck.findings.length,
            counts: cppcheck.counts,
            unparsed: cppcheck.errors.length,
          },
          'Cppcheck finished',
        );
        return cppcheck;
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

    if (detected.analyzers.includes('todo-scan')) {
      reports.todoScan = await runAnalyzer('todo-scan', analysisId, async () => {
        const todoScan = await runTodoScan(cloned.repoPath);
        logger.info(
          { analysisId, matches: todoScan.matches.length, counts: todoScan.counts },
          'TODO scan finished',
        );
        return todoScan;
      });
    }

    stage = 'normalize';
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

    stage = 'score';

    // Null on a first run, which marks everything NEW.
    const baseline = await fetchBaseline(analysisId);
    const matched = matchFindings({ findings, baseline: baseline?.findings ?? null });

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

    const debtDeltaMinutes = computeDebtDelta({
      currentDebtMinutes: score.debtMinutes,
      baseline: baseline?.findings ?? null,
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

    stage = 'gate';
    const gate = await fetchQualityGate(analysisId);

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

    stage = 'persist';

    const payload = buildResultsPayload({
      analysisId,
      commitSha: cloned.commitSha,
      findings: matched.findings,
      score,
      debtDeltaMinutes,
      gateResult: gateEvaluation.result,
      linesOfCode: detected.linesOfCode,
      // Nothing in the repo had an analyzer that could read it.
      analysisLimited: detected.analyzers.length === 0,
    });

    await postResults(payload);

    logger.info({ analysisId, findings: matched.findings.length }, 'Results persisted');

    // After persist, so a retry of a failed persist can't leave a second
    // comment on the PR. Renders the stored numbers, never a fresh count.
    await postPrComment({
      analysisId,
      body: buildPrComment({
        metrics: payload.metrics,
        findings: matched.findings,
        baseline,
        // Same thresholds the verdict was judged on, so a FAIL always shows why.
        gate: gate ?? DEFAULT_GATE,
      }),
    });

    // Hangs off the commit rather than the pull request, so push and manual
    // runs get a verdict too. The sha is the one that was checked out.
    await postCommitStatus({
      analysisId,
      commitSha: cloned.commitSha,
      evaluation: gateEvaluation,
    });
  } catch (err) {
    // Only this scope knows how far the run got, and the 'failed' listener has
    // to report it.
    throw Object.assign(err as Error, { stage });
  } finally {
    await cleanupWorkspace(workspace);
  }
}
