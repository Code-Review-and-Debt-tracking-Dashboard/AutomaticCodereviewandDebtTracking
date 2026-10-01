import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

export const options = {
  scenarios: {
    // NFR-1: burst of ~20 signed webhooks acknowledged well under 10s
    webhook_burst: {
      executor: 'shared-iterations',
      vus: 20,
      iterations: 20,
      maxDuration: '30s',
      startTime: '0s',
      exec: 'webhookScenario',
    },
    // NFR-3 / NFR-11: 5 concurrent users on repo list, snapshot and trend endpoints
    api_concurrent_users: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '1s',
      exec: 'apiScenario',
    },
  },
  thresholds: {
    'http_req_duration{scenario:webhook_burst}': ['p(95)<10000'], // Acknowledged well under 10s (NFR-1)
    'http_req_duration{scenario:api_concurrent_users}': ['p(95)<500'], // p95 < 500ms (NFR-3 / NFR-11)
    'http_req_failed{scenario:webhook_burst}': ['rate<0.01'],
    'http_req_failed{scenario:api_concurrent_users}': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || '1234567891011';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXNldGM2dnMwMDAwZWN2ZTBiN2ZrejhxIiwidXNlcm5hbWUiOiJCaGFneWF0Z24iLCJwbGF0Zm9ybVJvbGUiOiJVU0VSIiwianRpIjoiNjFlODVhMTktOTE4My00OTZlLTk1NzUtMjdmMGMwMTBkOTZlIiwidHlwIjoiYWNjZXNzIiwiaWF0IjoxNzkwMzIwMTI0LCJleHAiOjE3OTI5MTIxMjR9.2u_D-wbBJ0wogoVPEg7vZdIqC5cQHgJfM1z9K23cqOA';
const ORG_ID = __ENV.ORG_ID || 'cmsetc79n0002ecveodvcr16z';
const REPO_ID = __ENV.REPO_ID || 'cmufoptvv0002ckvenida3i58';
const GITHUB_REPO_ID = Number(__ENV.GITHUB_REPO_ID || '1138351205');

function generateSignature(payload) {
  const hash = crypto.hmac('sha256', WEBHOOK_SECRET, payload, 'hex');
  return `sha256=${hash}`;
}

export function webhookScenario() {
  // NFR-1: 20 signed push webhooks acknowledged in <10s
  const payload = JSON.stringify({
    ref: 'refs/heads/main',
    after: 'a1b2c3d4e5f678901234567890abcdef12345678',
    deleted: false,
    repository: {
      id: GITHUB_REPO_ID,
      clone_url: 'https://github.com/Bhagyatgn/Power-Plant-Decision-Support-Dashboard.git',
    },
  });

  const signature = generateSignature(payload);

  const res = http.post(`${BASE_URL}/webhooks/github`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
      'x-github-event': 'push',
      'x-load-test': 'true',
    },
    tags: { scenario: 'webhook_burst' },
  });

  check(res, {
    'webhook ACK status 200 or 202': (r) => r.status === 200 || r.status === 202,
    'webhook latency < 10s': (r) => r.timings.duration < 10000,
  });
}

export function apiScenario() {
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
      'x-load-test': 'true',
    },
  };

  // 1. Repo list endpoint
  const reposRes = http.get(`${BASE_URL}/api/orgs/${ORG_ID}/repos`, {
    ...authHeaders,
    tags: { scenario: 'api_concurrent_users', endpoint: 'repo_list' },
  });
  check(reposRes, {
    'repo list status 200': (r) => r.status === 200,
    'repo list latency < 500ms': (r) => r.timings.duration < 500,
  });

  // 2. Snapshot / Repo detail endpoint
  const snapshotRes = http.get(`${BASE_URL}/api/repos/${REPO_ID}`, {
    ...authHeaders,
    tags: { scenario: 'api_concurrent_users', endpoint: 'snapshot' },
  });
  check(snapshotRes, {
    'snapshot/detail status 200': (r) => r.status === 200,
    'snapshot/detail latency < 500ms': (r) => r.timings.duration < 500,
  });

  // 3. Trends endpoint
  const trendsRes = http.get(`${BASE_URL}/api/repos/${REPO_ID}/trend?days=30`, {
    ...authHeaders,
    tags: { scenario: 'api_concurrent_users', endpoint: 'trends' },
  });
  check(trendsRes, {
    'trends status 200': (r) => r.status === 200,
    'trends latency < 500ms': (r) => r.timings.duration < 500,
  });

  // 4. Mobile summary endpoint
  const summaryRes = http.get(`${BASE_URL}/api/mobile/summary`, {
    ...authHeaders,
    tags: { scenario: 'api_concurrent_users', endpoint: 'mobile_summary' },
  });
  check(summaryRes, {
    'summary status 200': (r) => r.status === 200,
    'summary latency < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'apps/api/tests/load/load-test-report.html': htmlReport(data, { title: 'CodePulse API Load Test Report (NFR-1 & NFR-3/NFR-11)' }),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
