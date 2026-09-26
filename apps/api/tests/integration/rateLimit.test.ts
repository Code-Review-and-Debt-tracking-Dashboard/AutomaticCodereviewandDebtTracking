import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createUser } from '../helpers/factories';

describe('rate limiting', () => {
  it('/auth/* allows 100 requests per window per IP, then 429s', async () => {
    for (let i = 0; i < 100; i++) {
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
    expect(res.headers['ratelimit-limit']).toBe('1000');
    expect(Number(res.headers['ratelimit-remaining'])).toBe(999);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  // just checks the count goes down
  it('counts API requests against the global budget', async () => {
    const user = await createUser();
    let last;
    for (let i = 0; i < 3; i++) {
      last = await api().get('/api/orgs').set(bearer(user));
      expect(last.status, `request ${i + 1}`).toBe(200);
    }
    expect(Number(last!.headers['ratelimit-remaining'])).toBe(997);
  });

  it('keys on the forwarded client IP rather than the proxy', async () => {
    const user = await createUser();

    const first = await api()
      .get('/api/orgs')
      .set(bearer(user))
      .set('X-Forwarded-For', '203.0.113.10');
    const second = await api()
      .get('/api/orgs')
      .set(bearer(user))
      .set('X-Forwarded-For', '203.0.113.99');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // different clients, so the second one is not sharing the first one's count
    expect(Number(second.headers['ratelimit-remaining'])).toBe(
      Number(first.headers['ratelimit-remaining']),
    );
  });
});
