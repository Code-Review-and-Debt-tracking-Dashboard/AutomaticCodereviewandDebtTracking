import { prisma } from '@codehealth/db';
import { beforeEach } from 'vitest';

import { redis } from '../../src/lib/redis';

let tables: string[] | undefined;
let canDisableTriggers = true;

// every table except prisma's migrations table
async function tableNames(): Promise<string[]> {
  if (!tables) {
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    tables = rows.map((r) => `"${r.tablename}"`);
  }
  return tables;
}

// DELETE is much faster than TRUNCATE here. falls back to TRUNCATE without superuser
async function clearDatabase(): Promise<void> {
  const names = await tableNames();

  if (canDisableTriggers) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        for (const name of names) {
          await tx.$executeRawUnsafe(`DELETE FROM ${name}`);
        }
      });
      return;
    } catch {
      canDisableTriggers = false;
    }
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`);
}

// flush redis so the rate limiter doesn't kick in mid suite
beforeEach(async () => {
  // redis flush is best effort
  await Promise.all([
    clearDatabase(),
    redis.flushdb().catch(() => { /* Redis unavailable — tolerate */ }),
  ]);
});
