import type {
  AnalysisFinding,
  AnalysisJobData,
  AnalysisResultsPayload,
  AnalysisStage,
  GateResult,
} from '@codehealth/shared';
import type { Job } from 'bullmq';
import type { Logger } from 'pino';

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
import { type Analyzer, detectLanguages } from '../stages/detect';
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
    toolVersions: {},
    analysisLimited: input.analysisLimited,
  };
}

async function runAnalyzer<T>(
  analyzer: Analyzer,
  log: Logger,
  fn: () => Promise<T>,
  summary: (report: T) => object,
): Promise<T | undefined> {
  try {
    const report = await fn();
    log.info({ analyzer, ...summary(report) }, 'Analyzer finished');
    return report;
  } catch (err) {
    log.error({ analyzer, err }, 'Analyzer failed');
    return undefined;
  }
}

export async function analysisProcessor(job: Job<AnalysisJobData>) {
  const { analysisId, repoId, branch, commitSha } = job.data;
  // every log below carries the analysisId
  const log = logger.child({ analysisId });

  await startJob(analysisId);

  log.info({ jobId: job.id, repoId, branch, commitSha }, 'Analysis started');

  let stage: AnalysisStage = 'clone';
  const workspace = await createWorkspace();

  try {
    // manual runs get the real sha from the clone
    const cloned = await cloneRepository(job.data, workspace);

    stage = 'detect';
    const detected = await detectLanguages(cloned.repoPath);

    stage = 'analyze';
    const reports: AnalyzerReports = {};

    // skips tools that weren't detected
    const run = <T>(
      analyzer: Analyzer,
      fn: (repoPath: string) => Promise<T>,
      summary: (report: T) => object,
    ) =>
      detected.analyzers.includes(analyzer)
        ? runAnalyzer(analyzer, log, () => fn(cloned.repoPath), summary)
        : undefined;

    reports.eslint = await run('eslint', runEslint, (r) => ({
      files: r.results.length,
      errors: r.errorCount,
      warnings: r.warningCount,
    }));
    reports.pylint = await run('pylint', runPylint, (r) => ({
      messages: r.messages.length,
      counts: r.counts,
    }));
    reports.bandit = await run('bandit', runBandit, (r) => ({
      results: r.results.length,
      counts: r.counts,
      nosec: r.nosec,
    }));
    reports.radon = await run('radon', runRadon, (r) => ({
      blocks: r.blocks.length,
      files: r.maintainability.length,
      counts: r.counts,
      miCounts: r.miCounts,
    }));
    reports.checkstyle = await run('checkstyle', runCheckstyle, (r) => ({
      violations: r.violations.length,
      counts: r.counts,
      unparsed: r.errors.length,
    }));
    reports.pmd = await run('pmd', runPmd, (r) => ({
      violations: r.violations.length,
      counts: r.counts,
      unparsed: r.errors.length,
    }));
    reports.cppcheck = await run('cppcheck', runCppcheck, (r) => ({
      findings: r.findings.length,
      counts: r.counts,
      unparsed: r.errors.length,
    }));
    reports.jscpd = await run('jscpd', runJscpd, (r) => ({
      duplicates: r.duplicates.length,
      percentage: r.percentage,
    }));
    reports.todoScan = await run('todo-scan', runTodoScan, (r) => ({
      matches: r.matches.length,
      counts: r.counts,
    }));

    stage = 'normalize';
    const { findings, duplicationPct } = normalize(reports);

    log.info(
      {
        findings: findings.length,
        duplicationPct,
        linesOfCode: detected.linesOfCode,
      },
      'Findings normalized',
    );

    stage = 'score';

    // null on first run, so everything is NEW
    const baseline = await fetchBaseline(analysisId);
    const matched = matchFindings({ findings, baseline: baseline?.findings ?? null });

    log.info(
      {
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

    log.info(
      {
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

    log.info(
      {
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
      analysisLimited: detected.analyzers.length === 0,
    });

    await postResults(payload);

    log.info({ findings: matched.findings.length }, 'Results persisted');

    // after persist so a retry doesn't post twice
    await postPrComment({
      analysisId,
      body: buildPrComment({
        metrics: payload.metrics,
        findings: matched.findings,
        baseline,
        gate: gate ?? DEFAULT_GATE,
      }),
    });

    // on the commit so push and manual runs get one too
    await postCommitStatus({
      analysisId,
      commitSha: cloned.commitSha,
      evaluation: gateEvaluation,
    });
  } catch (err) {
    // tag the stage for the failed listener
    throw Object.assign(err as Error, { stage });
  } finally {
    await cleanupWorkspace(workspace);
  }
}
