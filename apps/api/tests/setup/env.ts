// runs before src is imported. db and redis urls are always overridden
// so tests never wipe the dev database

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/code_review_test';

export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6380/1';

export const TEST_JWT_SECRET = 'integration_test_jwt_secret';
export const TEST_WEBHOOK_SECRET = 'integration_test_webhook_secret';
export const TEST_ADMIN_USER = 'admin';
export const TEST_ADMIN_PASSWORD = 'integration_test_admin_pw';
export const TEST_WEB_APP_URL = 'http://web.test';

const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, '');
if (!/_test$/.test(dbName)) {
  throw new Error(
    `Refusing to run integration tests against database "${dbName}" — the name must end in "_test"`,
  );
}

// don't use db 0, that's the dev queue
const redisDb = new URL(TEST_REDIS_URL).pathname.replace(/^\//, '');
if (!redisDb || redisDb === '0') {
  throw new Error('TEST_REDIS_URL must select a non-zero Redis db index, e.g. redis://localhost:6380/1');
}

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'silent';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = TEST_REDIS_URL;
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
process.env.GITHUB_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
process.env.GITHUB_CLIENT_ID = 'test_client_id';
process.env.GITHUB_CLIENT_SECRET = 'test_client_secret';
process.env.GITHUB_OAUTH_CALLBACK_URL = 'http://api.test/auth/github/callback';
process.env.GITHUB_WEBHOOK_URL = 'http://api.test/webhooks/github';
process.env.WEB_APP_URL = TEST_WEB_APP_URL;
process.env.WEB_APP_ORIGINS = TEST_WEB_APP_URL;
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAMESITE = 'lax';
process.env.ENABLE_DEV_LOGIN = 'false';
process.env.TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ADMIN_BASIC_AUTH_USER = TEST_ADMIN_USER;
process.env.ADMIN_BASIC_AUTH_PASSWORD = TEST_ADMIN_PASSWORD;
