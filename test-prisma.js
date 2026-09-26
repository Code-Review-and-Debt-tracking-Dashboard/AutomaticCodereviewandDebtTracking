process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/code_review_test";

const { prisma } = require("./packages/db");

prisma.$queryRawUnsafe("SELECT current_database(), current_user")
  .then(x => console.log(x))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
