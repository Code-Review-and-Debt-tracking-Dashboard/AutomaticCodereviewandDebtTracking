/**
 * Loads and validates the environment variables needed for the GitHub OAuth
 * flow  Fails fast at boot if anything required is missing, rather
 * than surfacing a confusing error later on the first login attempt.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  githubClientId: required('GITHUB_CLIENT_ID'),
  githubClientSecret: required('GITHUB_CLIENT_SECRET'),
  githubOAuthCallbackUrl: required('GITHUB_OAUTH_CALLBACK_URL'),

  // Shared secret configured on the GitHub webhook ; used to verify
  // the X-Hub-Signature-256 HMAC-SHA256 signature on incoming payloads.
  githubWebhookSecret: required('GITHUB_WEBHOOK_SECRET'),

  // Publicly reachable URL GitHub delivers webhook events to. Set on every
  // hook we register when a repository is linked, so it has to be the address
  // GitHub can actually reach — a tunnel URL during local development.
  githubWebhookUrl: required('GITHUB_WEBHOOK_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 32-byte (64 hex chars) key for AES-256-GCM token-at-rest encryption.
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'),
};
