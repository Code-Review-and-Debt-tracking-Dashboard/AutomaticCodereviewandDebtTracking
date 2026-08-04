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

  // Redis backs the analysis job queue. Defaults to the local Compose
  // service so a fresh checkout boots without extra setup.
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  githubClientId: required('GITHUB_CLIENT_ID'),
  githubClientSecret: required('GITHUB_CLIENT_SECRET'),
  githubOAuthCallbackUrl: required('GITHUB_OAUTH_CALLBACK_URL'),

  githubWebhookSecret: required('GITHUB_WEBHOOK_SECRET'),
  // must be reachable by GitHub — use a tunnel URL locally
  githubWebhookUrl: required('GITHUB_WEBHOOK_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 64 hex chars = 32 bytes
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'),
};
