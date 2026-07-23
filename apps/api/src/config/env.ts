/**
 * Loads and validates the environment variables needed for the GitHub OAuth
 * flow (A-05). Fails fast at boot if anything required is missing, rather
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

  githubClientId: required('GITHUB_CLIENT_ID'),
  githubClientSecret: required('GITHUB_CLIENT_SECRET'),
  githubOAuthCallbackUrl: required('GITHUB_OAUTH_CALLBACK_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 32-byte (64 hex chars) key for AES-256-GCM token-at-rest encryption.
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'),
};
