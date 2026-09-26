import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// prisma needs the pg adapter and the url passed in at runtime
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// one shared client
export const prisma = new PrismaClient({ adapter });

export * from '@prisma/client';
