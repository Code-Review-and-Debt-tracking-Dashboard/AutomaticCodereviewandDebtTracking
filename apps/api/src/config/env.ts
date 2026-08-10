/**
 * Loads and validates the environment variables needed for the GitHub OAuth
 * flow  Fails fast at boot if anything required is missing, rather
 * than surfacing a confusing error later on the first login attempt.
 */
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

  // Redis backing the BullMQ analysis queue.
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),

  githubClientId: required('GITHUB_CLIENT_ID', 'dev_github_client_id'),
  githubClientSecret: required('GITHUB_CLIENT_SECRET', 'dev_github_client_secret'),
  githubOAuthCallbackUrl: required('GITHUB_OAUTH_CALLBACK_URL', 'http://localhost:4000/auth/github/callback'),

  // Shared secret configured on the GitHub webhook ; used to verify
  // the X-Hub-Signature-256 HMAC-SHA256 signature on incoming payloads.
  githubWebhookSecret: required('GITHUB_WEBHOOK_SECRET', 'dev_webhook_secret'),

  // Public URL each repo's webhook is pointed at, so GitHub must be able to
  // reach it — use a tunnel locally.
  githubWebhookUrl: required('GITHUB_WEBHOOK_URL', 'http://localhost:4000/webhooks/github'),

  jwtSecret: required('JWT_SECRET', 'dev_jwt_secret_key_1234567890'),

  // Where the OAuth callback sends the browser once login succeeds.
  webAppUrl: required('WEB_APP_URL', 'http://localhost:5173'),

  // Origins allowed to send credentialed requests. Cannot be a wildcard —
  // browsers reject "*" the moment credentials are enabled.
  webAppOrigins: (process.env.WEB_APP_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7,

  cookieSecure: (process.env.COOKIE_SECURE || String(process.env.NODE_ENV === 'production')) === 'true',
  // 'none' is needed if the web app and API are on different sites; browsers
  // then also demand Secure, which setRefreshCookie enforces.
  cookieSameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',

  // Password-less login for local work. Never mounted in production.
  enableDevLogin: process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true',

  // 32-byte (64 hex chars) key for AES-256-GCM token-at-rest encryption.
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
};
