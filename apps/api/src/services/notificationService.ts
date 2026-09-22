import type { Prisma, NotificationType } from '@codehealth/db';
import type { AnalysisFinding, SnapshotMetrics } from '@codehealth/shared';

// A fall of more than this many points since the last analysis is worth telling
// people about.
const SCORE_DROP_POINTS = 10;

interface NotificationEvent {
  type: NotificationType;
  title: string;
  body: string;
  data: Prisma.InputJsonValue;
}

// healthScore is a float, so bodies would otherwise read "down 14.299999997".
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Creates the notification rows for one finished analysis: the quality gate
 * failed, the score fell sharply, or a new critical vulnerability turned up.
 *
 * Runs inside the ingest transaction so the rows land with the snapshot or not
 * at all. That also makes it idempotent for free — a worker retry of a run that
 * was already stored never reaches here.
 */
export async function createAnalysisNotifications(
  tx: Prisma.TransactionClient,
  input: {
    repoId: string;
    snapshotId: string;
    metrics: SnapshotMetrics;
    findings: AnalysisFinding[];
    previousScore: number | null;
  },
): Promise<void> {
  const { repoId, snapshotId, metrics, findings, previousScore } = input;

  const gateFailed = metrics.gateResult === 'FAIL';
  const drop = previousScore === null ? 0 : previousScore - metrics.healthScore;
  const criticals = findings.filter(
    (f) => f.severity === 'CRITICAL' && f.category === 'VULNERABILITY' && f.state === 'NEW',
  );

  if (!gateFailed && drop <= SCORE_DROP_POINTS && criticals.length === 0) {
    return;
  }

  const repo = await tx.repository.findUniqueOrThrow({
    where: { id: repoId },
    select: {
      name: true,
      ownerId: true,
      members: { where: { status: 'ACTIVE' }, select: { userId: true } },
    },
  });

  const events: NotificationEvent[] = [];

  if (gateFailed) {
    events.push({
      type: 'QUALITY_GATE_FAILED',
      title: `Quality gate failed — ${repo.name}`,
      body: `Health score ${round1(metrics.healthScore)}. ${metrics.totalIssues} issues in this analysis.`,
      data: {
        healthScore: metrics.healthScore,
        gateResult: metrics.gateResult,
        totalIssues: metrics.totalIssues,
      },
    });
  }

  if (drop > SCORE_DROP_POINTS) {
    events.push({
      type: 'SCORE_DROPPED',
      title: `Health score dropped — ${repo.name}`,
      body: `Down ${round1(drop)} points, from ${round1(previousScore!)} to ${round1(metrics.healthScore)}.`,
      data: { previousScore, healthScore: metrics.healthScore, delta: -drop },
    });
  }

  if (criticals.length > 0) {
    const worst = criticals[0];
    events.push({
      type: 'CRITICAL_FINDING',
      title: `Critical vulnerability — ${repo.name}`,
      body: `${criticals.length} new critical ${criticals.length === 1 ? 'vulnerability' : 'vulnerabilities'}. ${worst.rule} in ${worst.file ?? 'an unknown file'}.`,
      data: { count: criticals.length, rule: worst.rule, file: worst.file },
    });
  }

  // The owner usually has a member row too, so the set is what stops them
  // getting the same notification twice.
  const userIds = new Set([repo.ownerId, ...repo.members.map((m) => m.userId)]);

  await tx.notification.createMany({
    data: [...userIds].flatMap((userId) =>
      events.map((event) => ({ ...event, userId, repoId, snapshotId })),
    ),
  });
}
