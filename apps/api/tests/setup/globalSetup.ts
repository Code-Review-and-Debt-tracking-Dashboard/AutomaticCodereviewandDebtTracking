import { execFileSync } from 'child_process';
import { resolve } from 'path';

import { Client } from 'pg';

import { TEST_DATABASE_URL } from './env';

// creates the test db if needed and runs migrations
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
    // dotenv won't override this
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
