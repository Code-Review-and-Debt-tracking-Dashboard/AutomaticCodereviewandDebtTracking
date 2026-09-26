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
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // same redis as the API
  redisUrl: required('REDIS_URL', 'redis://localhost:6380'),

  concurrency: Number(process.env.WORKER_CONCURRENCY) || 2,

  // same key as the API
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  cloneTimeoutMs: Number(process.env.CLONE_TIMEOUT_MS) || 120_000,

  // worker writes results through the API
  apiBaseUrl: required('API_BASE_URL', 'http://localhost:4000'),

  agentToken: required('AGENT_TOKEN', 'dev_agent_token'),

  // both must match the API's
  githubWebhookUrl: required('GITHUB_WEBHOOK_URL', 'http://localhost:4000/webhooks/github'),
  githubWebhookSecret: required('GITHUB_WEBHOOK_SECRET', 'dev_webhook_secret'),
};
