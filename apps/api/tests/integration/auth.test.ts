import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { REFRESH_COOKIE_NAME, STATE_COOKIE_NAME } from '../../src/lib/cookies';
import { signState } from '../../src/lib/jwt';
import { createSession } from '../../src/services/sessionService';
import { api } from '../helpers/app';
import { bearer, stateTokenAsBearer, tokenFor } from '../helpers/auth';
import { createUser } from '../helpers/factories';
import { TEST_WEB_APP_URL } from '../setup/env';

const cookieNamed = (res: { headers: Record<string, unknown> }, name: string): string | undefined => {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return list.find((c) => c.startsWith(`${name}=`));
};

describe('GET /auth/github', () => {
  it('redirects to GitHub with a signed state and binds it to a cookie', async () => {
    const res = await api().get('/auth/github');

    expect(res.status).toBe(302);
    const url = new URL(res.headers.location);
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('test_client_id');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(cookieNamed(res, STATE_COOKIE_NAME)).toMatch(/HttpOnly/);
  });
});

describe('GET /auth/github/callback', () => {
  const loginError = (code: string) => `${TEST_WEB_APP_URL}/login?error=${code}`;

  it('without a code bounces back to the login page', async () => {
    const res = await api().get('/auth/github/callback');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(loginError('INVALID_CODE'));
  });

  it('rejects a garbage state', async () => {
    const res = await api().get('/auth/github/callback').query({ code: 'x', state: 'not-a-jwt' });
    expect(res.headers.location).toBe(loginError('INVALID_STATE'));
  });

  it('rejects a valid state whose nonce is not in this browser', async () => {
    const { state } = signState(undefined, 'web');
    const res = await api()
      .get('/auth/github/callback')
      .query({ code: 'x', state })
      .set('Cookie', `${STATE_COOKIE_NAME}=someone-elses-nonce`);
    expect(res.headers.location).toBe(loginError('INVALID_STATE'));
  });

  it('always clears the state cookie', async () => {
    const res = await api().get('/auth/github/callback');
    expect(cookieNamed(res, STATE_COOKIE_NAME)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('POST /auth/refresh', () => {
  it('401 with no token in cookie or body', async () => {
    const res = await api().post('/auth/refresh').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_REFRESH_TOKEN');
  });

  it('400 when the body token is an empty string', async () => {
    const res = await api().post('/auth/refresh').send({ refreshToken: '' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ status: 'error', message: 'Validation failed' });
  });

  it('401 for an unknown token', async () => {
    const res = await api().post('/auth/refresh').send({ refreshToken: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rotates a body token and returns the replacement in the body (native client)', async () => {
    const user = await createUser();
    const { refreshToken } = await createSession(user);

    const res = await api().post('/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, username: user.username });
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.refreshToken).not.toBe(refreshToken);
    expect(cookieNamed(res, REFRESH_COOKIE_NAME)).toBeUndefined();

    const me = await api().get('/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('rotates a cookie token and answers with a cookie, never a body token (web client)', async () => {
    const user = await createUser();
    const { refreshToken } = await createSession(user);

    const res = await api().post('/auth/refresh').set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeUndefined();
    expect(cookieNamed(res, REFRESH_COOKIE_NAME)).toMatch(/HttpOnly/);
    expect(cookieNamed(res, REFRESH_COOKIE_NAME)).toMatch(/Path=\/auth/);
  });

  it('a token replayed within the grace window still works', async () => {
    const user = await createUser();
    const { refreshToken } = await createSession(user);

    await api().post('/auth/refresh').send({ refreshToken });
    const replay = await api().post('/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(200);
  });

  it('a token replayed after the grace window kills the whole family', async () => {
    const user = await createUser();
    const first = await createSession(user);
    const rotated = await api().post('/auth/refresh').send({ refreshToken: first.refreshToken });

    // age the spent token past ROTATION_GRACE_MS without waiting
    await prisma.session.updateMany({
      where: { userId: user.id, revokedReason: 'ROTATED' },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    const replay = await api().post('/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    const latest = await api().post('/auth/refresh').send({ refreshToken: rotated.body.refreshToken });
    expect(latest.status).toBe(401);
    expect(latest.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('401 for an expired token', async () => {
    const user = await createUser();
    const { refreshToken } = await createSession(user);
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });

    const res = await api().post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  it('401 and revokes when the user has been deactivated', async () => {
    const user = await createUser();
    const { refreshToken } = await createSession(user);
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });

    const res = await api().post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');

    const again = await api().post('/auth/refresh').send({ refreshToken });
    expect(again.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /auth/logout', () => {
  it('204 with no token at all', async () => {
    const res = await api().post('/auth/logout');
    expect(res.status).toBe(204);
  });

  it('204 for an unknown token — never reveals whether it existed', async () => {
    const res = await api().post('/auth/logout').send({ refreshToken: 'nope' });
    expect(res.status).toBe(204);
  });

  it('revokes the session and clears the cookie', async () => {
    const user = await createUser();
    const { refreshToken } = await createSession(user);

    const res = await api().post('/auth/logout').set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);
    expect(res.status).toBe(204);
    expect(cookieNamed(res, REFRESH_COOKIE_NAME)).toMatch(/Expires=Thu, 01 Jan 1970/);

    const refresh = await api().post('/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('401 without a token', async () => {
    const res = await api().get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid auth token' } });
  });

  it('401 for a malformed token', async () => {
    const res = await api().get('/auth/me').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('401 for a non-Bearer scheme', async () => {
    const user = await createUser();
    const res = await api().get('/auth/me').set('Authorization', `Token ${tokenFor(user)}`);
    expect(res.status).toBe(401);
  });

  it('401 for an OAuth state token used as a bearer token', async () => {
    const res = await api().get('/auth/me').set(stateTokenAsBearer());
    expect(res.status).toBe(401);
  });

  it('returns the current user', async () => {
    const user = await createUser();
    const res = await api().get('/auth/me').set(bearer(user));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      username: user.username,
      email: user.email,
      platformRole: 'USER',
    });
  });

  it('401 when the token outlives the user row', async () => {
    const user = await createUser();
    const headers = bearer(user);
    await prisma.user.delete({ where: { id: user.id } });

    const res = await api().get('/auth/me').set(headers);
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/dev-login', () => {
  it('is not mounted when ENABLE_DEV_LOGIN is off', async () => {
    const res = await api().post('/auth/dev-login').send({ username: 'anyone' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
