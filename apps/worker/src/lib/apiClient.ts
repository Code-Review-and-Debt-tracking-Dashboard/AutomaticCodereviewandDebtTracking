import type {
  AnalysisFailurePayload,
  AnalysisResultsPayload,
  QualityGateThresholds,
} from '@codehealth/shared';

import { env } from '../config/env';

/**
 * The worker's only way to write anything. It holds no database credentials, so
 * every status transition and every result goes over this authenticated API.
 *
 * There is no retry in here on purpose. A failed call throws, BullMQ retries the
 * whole job, and the results endpoint ignores a second delivery of a run it has
 * already stored — so one backoff policy covers the lot instead of two.
 */
async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.agentToken}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  }

  return res;
}

export async function startJob(analysisId: string): Promise<void> {
  await request('POST', `/jobs/${analysisId}/start`);
}

// Null when the repo has no gate configured, which the gate stage reads as
// "use the defaults".
export async function fetchQualityGate(
  analysisId: string,
): Promise<QualityGateThresholds | null> {
  const res = await request('GET', `/jobs/${analysisId}/quality-gate`);
  return res.status === 204 ? null : ((await res.json()) as QualityGateThresholds);
}

export async function postResults(payload: AnalysisResultsPayload): Promise<void> {
  await request('POST', `/jobs/${payload.analysisId}/results`, payload);
}

export async function reportFailure(payload: AnalysisFailurePayload): Promise<void> {
  await request('POST', `/jobs/${payload.analysisId}/fail`, payload);
}
