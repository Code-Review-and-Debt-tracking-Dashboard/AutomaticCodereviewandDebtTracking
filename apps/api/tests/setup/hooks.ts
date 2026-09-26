import { prisma } from '@codehealth/db';
import { beforeEach } from 'vitest';

import { redis } from '../../src/lib/redis';

let tables: string[] | undefined;
let canDisableTriggers = true;

// Every table except Prisma's migration ledger. Read once from the catalog so
// a new model in schema.prisma is covered without touching this file.
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

// TRUNCATE is ~50x slower than DELETE on these tiny tables (it rewrites
// files), so delete instead. Turning off FK triggers for the transaction
// means no dependency ordering is needed; that needs superuser, which the
// docker-compose and CI service users have. Anything else falls back to
// TRUNCATE ... CASCADE.
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

// The global rate limiter is 100 requests / 15 min per IP, and supertest is
// always the same IP, so without a flush the suite would start 429ing
// partway through. Flushing the whole (dedicated, non-zero) db also clears
// the BullMQ queue and OAuth state nonces.
beforeEach(async () => {
  // DB clear must always succeed; Redis flush is best-effort (Redis may not
  // be available in local dev environments).
  await Promise.all([
    clearDatabase(),
    redis.flushdb().catch(() => { /* Redis unavailable — tolerate */ }),
  ]);
});
