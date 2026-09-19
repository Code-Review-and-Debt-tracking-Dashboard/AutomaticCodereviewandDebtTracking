import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createUser } from '../helpers/factories';

// The limiters are backed by the test Redis db, which hooks.ts flushes before
// every test, so each test starts with a clean window.
describe('rate limiting', () => {
  it('/auth/* allows 20 requests per window per IP, then 429s', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await api().post('/auth/logout');
      expect(res.status, `request ${i + 1}`).toBe(204);
    }

    const limited = await api().post('/auth/logout');
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' } });
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('exposes standard RateLimit headers on API routes', async () => {
    const user = await createUser();
    const res = await api().get('/api/orgs').set(bearer(user));
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('100');
    expect(Number(res.headers['ratelimit-remaining'])).toBe(99);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('the global limit is 100 per window per IP', async () => {
    const user = await createUser();
    // /api/orgs is cheap and exempt from nothing, so it counts every hit
    let last;
    for (let i = 0; i < 100; i++) {
      last = await api().get('/api/orgs').set(bearer(user));
      expect(last.status, `request ${i + 1}`).toBe(200);
    }
    expect(Number(last!.headers['ratelimit-remaining'])).toBe(0);

    const limited = await api().get('/api/orgs').set(bearer(user));
    expect(limited.status).toBe(429);
  });
});
