import { type ChildProcess, execFileSync, spawn } from 'child_process';
import { createHash, createHmac } from 'crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

import { prisma } from '@codehealth/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, app } from '../helpers/app';
import { createOrg, createQualityGate, createRepo, createUser } from '../helpers/factories';
import { TEST_WEBHOOK_SECRET } from '../setup/env';

// runs the real worker as a separate process

const AGENT_TOKEN = 'e2e-agent-token';
const workerDir = resolve(__dirname, '../../../worker');
const tsxCli = resolve(__dirname, '../../../../node_modules/tsx/dist/cli.mjs');

let server: Server;
let fixtureDir: string;
let fixtureSha: string;

// one file with an eval and a TODO
function createFixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'codehealth-e2e-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(
    join(dir, 'src/run.js'),
    [
      '// TODO: validate input',
      'function run(input) {',
      '  return eval(input);',
      '}',
      'module.exports = { run };',
      '',
    ].join('\n'),
  );

  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@test', ...args], {
      cwd: dir,
      encoding: 'utf8',
    });
  git('init', '-b', 'main');
  git('add', '.');
  git('commit', '-m', 'init');
  fixtureSha = git('rev-parse', 'HEAD').trim();

  return dir;
}

function startWorker(apiPort: number): ChildProcess {
  return spawn(process.execPath, [tsxCli, 'src/index.ts'], {
    cwd: workerDir,
    env: {
      ...process.env,
      API_BASE_URL: `http://127.0.0.1:${apiPort}`,
      AGENT_TOKEN,
    },
    stdio: 'inherit',
  });
}

async function stopWorker(worker: ChildProcess): Promise<void> {
  if (worker.exitCode !== null) return;
  const exited = new Promise((done) => worker.once('exit', done));
  worker.kill('SIGTERM');
  await exited;
}

function pushWebhook(githubRepoId: number) {
  const body = JSON.stringify({
    ref: 'refs/heads/main',
    after: fixtureSha,
    deleted: false,
    repository: { id: githubRepoId, clone_url: pathToFileURL(fixtureDir).href },
  });
  const signature = 'sha256=' + createHmac('sha256', TEST_WEBHOOK_SECRET).update(body).digest('hex');

  return api()
    .post('/webhooks/github')
    .set('Content-Type', 'application/json')
    .set('X-GitHub-Event', 'push')
    .set('X-Hub-Signature-256', signature)
    .send(body);
}

async function waitForJob(id: string) {
  for (;;) {
    const job = await prisma.analysisJob.findUniqueOrThrow({ where: { id } });
    if (job.status === 'COMPLETED' || job.status === 'FAILED') return job;
    await new Promise((r) => setTimeout(r, 500));
  }
}

beforeAll(async () => {
  fixtureDir = createFixtureRepo();
  server = app.listen(0);
  await new Promise((done) => server.once('listening', done));
});

afterAll(async () => {
  await new Promise((done) => server.close(done));
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe('analysis pipeline, end to end', () => {
  it('turns a push webhook into a stored snapshot, findings and a notification', async () => {
    const owner = await createUser();
    const org = await createOrg();
    const repo = await createRepo(org, owner, { githubRepoId: '5001' });
    // Any finding at all fails a gate of 100.
    await createQualityGate(repo, { minHealthScore: 100 });
    await prisma.agent.create({
      data: { tokenHash: createHash('sha256').update(AGENT_TOKEN).digest('hex'), orgId: null },
    });

    // start after the redis flush
    const worker = startWorker((server.address() as AddressInfo).port);

    try {
      const res = await pushWebhook(5001);
      expect(res.status).toBe(202);

      const job = await waitForJob(res.body.analysisId);
      expect(job).toMatchObject({ status: 'COMPLETED', progress: 100, commitSha: fixtureSha });

      const snapshot = await prisma.healthSnapshot.findUniqueOrThrow({
        where: { analysisId: job.id },
        include: { findings: true },
      });
      expect(snapshot.linesOfCode).toBe(5);
      expect(snapshot.healthScore).toBeLessThan(100);
      expect(snapshot.gateResult).toBe('FAIL');
      expect(snapshot.totalIssues).toBe(snapshot.findings.length);

      expect(snapshot.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: 'eslint',
            rule: 'security/detect-eval-with-expression',
            category: 'VULNERABILITY',
            severity: 'HIGH',
            state: 'NEW',
            file: 'src/run.js',
          }),
          expect.objectContaining({ tool: 'todo-scan', file: 'src/run.js', line: 1 }),
        ]),
      );

      const notifications = await prisma.notification.findMany({ where: { userId: owner.id } });
      expect(notifications).toEqual([
        expect.objectContaining({ type: 'QUALITY_GATE_FAILED', snapshotId: snapshot.id }),
      ]);
    } finally {
      await stopWorker(worker);
    }
  }, 120_000);
});
