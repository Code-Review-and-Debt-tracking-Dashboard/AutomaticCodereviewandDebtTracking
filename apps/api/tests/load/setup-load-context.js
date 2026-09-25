const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: 'apps/api/.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const repos = await prisma.repository.findMany({
    where: { isActive: true },
    include: { organization: true, owner: true, members: { include: { user: true } } }
  });

  if (repos.length === 0) {
    console.log('No active repos found');
    return;
  }

  const repo = repos[0];
  const user = repo.owner || (repo.members[0] && repo.members[0].user);
  const org = repo.organization;

  const jwtSecret = process.env.JWT_SECRET;
  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      platformRole: user.platformRole || 'ADMIN',
      jti: randomUUID(),
      typ: 'access'
    },
    jwtSecret,
    { expiresIn: '30d' }
  );

  console.log(JSON.stringify({
    token,
    user: { id: user.id, username: user.username },
    org: { id: org?.id, login: org?.login },
    repo: { id: repo.id, name: repo.name, githubRepoId: String(repo.githubRepoId) },
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '1234567891011'
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
