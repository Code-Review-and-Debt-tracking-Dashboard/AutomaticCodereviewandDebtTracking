import { execFileSync } from 'child_process';
import { resolve } from 'path';

import { Client } from 'pg';

import { TEST_DATABASE_URL } from './env';

// Runs once, in its own process, before any test file. Creates the test
// database if it doesn't exist and brings it to the current migration state.
// Truncation between tests is the hooks' job; this only sets up the schema.
export async function setup(): Promise<void> {
  await ensureDatabaseExists();
  migrate();
}

async function ensureDatabaseExists(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.replace(/^\//, '');

  // connect to the maintenance db to create the test db
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await client.end();
  }
}

function migrate(): void {
  const dbPackage = resolve(__dirname, '../../../../packages/db');
  const prismaBin = resolve(__dirname, '../../../../node_modules/prisma/build/index.js');
  execFileSync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
    cwd: dbPackage,
    // prisma.config.ts loads dotenv, which never overrides a var that is
    // already set, so this wins over packages/db/.env
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
