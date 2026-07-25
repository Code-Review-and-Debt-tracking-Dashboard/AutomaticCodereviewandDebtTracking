import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Prisma 7's "client" query engine has no bundled query engine binary — it
// requires an explicit driver adapter. schema.prisma's datasource has no
// `url` (Prisma 7 reads that from prisma.config.ts for the CLI only), so the
// connection string must be passed here at runtime too.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Single shared Prisma client instance for the whole process. Both apps/api
// and apps/worker import this instead of constructing their own PrismaClient,
// so they share one connection pool.
export const prisma = new PrismaClient({ adapter });

export * from '@prisma/client';
