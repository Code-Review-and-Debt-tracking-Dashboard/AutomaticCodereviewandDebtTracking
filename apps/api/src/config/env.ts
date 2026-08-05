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

  githubClientId: required('GITHUB_CLIENT_ID', 'dev_github_client_id'),
  githubClientSecret: required('GITHUB_CLIENT_SECRET', 'dev_github_client_secret'),
  githubOAuthCallbackUrl: required('GITHUB_OAUTH_CALLBACK_URL', 'http://localhost:4000/auth/github/callback'),

  // Shared secret configured on the GitHub webhook ; used to verify
  // the X-Hub-Signature-256 HMAC-SHA256 signature on incoming payloads.
  githubWebhookSecret: required('GITHUB_WEBHOOK_SECRET', 'dev_webhook_secret'),

  jwtSecret: required('JWT_SECRET', 'dev_jwt_secret_key_1234567890'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 32-byte (64 hex chars) key for AES-256-GCM token-at-rest encryption.
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
};
