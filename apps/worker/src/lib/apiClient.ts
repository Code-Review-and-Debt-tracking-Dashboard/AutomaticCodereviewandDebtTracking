import type {
  AnalysisFailurePayload,
  AnalysisResultsPayload,
  BaselineSnapshot,
  QualityGateThresholds,
} from '@codehealth/shared';

import { env } from '../config/env';

// no retry here, bullmq retries the whole job
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

// null = no gate set, use defaults
export async function fetchQualityGate(
  analysisId: string,
): Promise<QualityGateThresholds | null> {
  const res = await request('GET', `/jobs/${analysisId}/quality-gate`);
  return res.status === 204 ? null : ((await res.json()) as QualityGateThresholds);
}

// null on the first run
export async function fetchBaseline(analysisId: string): Promise<BaselineSnapshot | null> {
  const res = await request('GET', `/jobs/${analysisId}/baseline`);
  return res.status === 204 ? null : ((await res.json()) as BaselineSnapshot);
}

export async function postResults(payload: AnalysisResultsPayload): Promise<void> {
  await request('POST', `/jobs/${payload.analysisId}/results`, payload);
}

export async function reportFailure(payload: AnalysisFailurePayload): Promise<void> {
  await request('POST', `/jobs/${payload.analysisId}/fail`, payload);
}

export async function queueFirstAnalysis(repoId: string): Promise<void> {
  await request('POST', `/jobs/repos/${repoId}/first-analysis`);
}
