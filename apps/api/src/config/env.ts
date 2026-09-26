// fail at boot if something required is missing
function required(name: string, fallbackDevValue?: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV !== 'production' && fallbackDevValue !== undefined) {
      return fallbackDevValue;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),

  githubClientId: required('GITHUB_CLIENT_ID', 'dev_github_client_id'),
  githubClientSecret: required('GITHUB_CLIENT_SECRET', 'dev_github_client_secret'),
  githubOAuthCallbackUrl: required('GITHUB_OAUTH_CALLBACK_URL', 'http://localhost:4000/auth/github/callback'),

  // used to verify webhook signatures
  githubWebhookSecret: required('GITHUB_WEBHOOK_SECRET', 'dev_webhook_secret'),

  // must be public, use a tunnel locally
  githubWebhookUrl: required('GITHUB_WEBHOOK_URL', 'http://localhost:4000/webhooks/github'),

  jwtSecret: required('JWT_SECRET', 'dev_jwt_secret_key_1234567890'),

  webAppUrl: required('WEB_APP_URL', 'http://localhost:5173'),

  // can't be "*" with credentials
  webAppOrigins: (process.env.WEB_APP_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7,

  cookieSecure: (process.env.COOKIE_SECURE || String(process.env.NODE_ENV === 'production')) === 'true',
  // use 'none' if web and API are on different sites
  cookieSameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',

  // never on in production
  enableDevLogin: process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true',

  // 64 hex chars
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  // basic auth for bull board
  adminBasicAuthUser: required('ADMIN_BASIC_AUTH_USER', 'admin'),
  adminBasicAuthPassword: required('ADMIN_BASIC_AUTH_PASSWORD', 'admin'),

  // optional, only for expo enhanced push security
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
};
