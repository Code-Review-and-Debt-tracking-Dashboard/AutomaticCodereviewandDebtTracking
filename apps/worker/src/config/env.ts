/**
 * Environment for the worker process. Fails fast at boot if something required
 * is missing, instead of the first job dying on it.
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
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Has to point at the same Redis as the API, or the worker listens to an
  // empty queue while jobs pile up in another one.
  redisUrl: required('REDIS_URL', 'redis://localhost:6380'),

  // How many jobs run at once in this process.
  concurrency: Number(process.env.WORKER_CONCURRENCY) || 2,
};
