import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';

describe('GET /health', () => {
  it('is public and reports both dependencies up', async () => {
    const res = await api().get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'healthy',
      checks: { database: true, redis: true },
    });
    expect(typeof res.body.uptime).toBe('number');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('is exempt from the global rate limiter', async () => {
    const res = await api().get('/health');
    expect(res.headers['ratelimit-limit']).toBeUndefined();
    expect(res.headers['ratelimit']).toBeUndefined();
  });

  it('unknown routes get the generic 404 envelope', async () => {
    const res = await api().get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route GET /nope not found' } });
  });
});
