import cookieParser from 'cookie-parser';
import { Router } from 'express';

import { env } from '../config/env';
import {
  clearRefreshCookie,
  clearStateCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  setStateCookie,
  STATE_COOKIE_NAME,
} from '../lib/cookies';
import { signAccessToken } from '../lib/jwt';
import { AppError } from '../middleware/errorHandler';
import { authRateLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/zodValidate';
import { devLoginBodySchema, refreshTokenBodySchema } from '../schemas/requestSchemas';
import {
  buildGithubAuthorizeUrl,
  devLogin,
  getAuthenticatedUser,
  handleGithubCallback,
  toPublicUser,
} from '../services/authService';
import { revokeSessionByToken, rotateSession } from '../services/sessionService';

export const authRouter = Router();
// scoped to /auth, the router is mounted at root
authRouter.use('/auth', authRateLimiter);

const cookies = cookieParser();

authRouter.get('/auth/github', (req, res) => {
  const client = req.query.client === 'native' ? 'native' : 'web';
  const { url, nonce } = buildGithubAuthorizeUrl(req.query.redirect, client);
  setStateCookie(res, nonce);
  res.redirect(url);
});

authRouter.get('/auth/github/callback', cookies, async (req, res, next) => {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const cookieNonce = req.cookies?.[STATE_COOKIE_NAME] as string | undefined;

  // single use
  clearStateCookie(res);

  try {
    const result = await handleGithubCallback(code, state, cookieNonce);

    // mobile can't use cookies, so send tokens back on the deep link
    if (result.client === 'native') {
      if (!result.redirectTo) {
        res.status(400).json({
          error: { code: 'INVALID_REDIRECT', message: 'Missing native redirect target' },
        });
        return;
      }
      const url = new URL(result.redirectTo);
      url.searchParams.set('accessToken', result.accessToken);
      url.searchParams.set('refreshToken', result.refreshToken);
      url.searchParams.set('expiresAt', result.expiresAt.toISOString());
      res.redirect(url.toString());
      return;
    }

    setRefreshCookie(res, result.refreshToken, result.expiresAt);
    res.redirect(`${env.webAppUrl}${result.redirectTo ?? '/auth/callback'}`);
  } catch (err) {
    if (err instanceof AppError) {
      res.redirect(`${env.webAppUrl}/login?error=${encodeURIComponent(err.code)}`);
      return;
    }
    next(err);
  }
});

// no requireAuth, the access token has expired
authRouter.post('/auth/refresh', cookies, validateRequest(refreshTokenBodySchema), async (req, res, next) => {
  const fromCookie: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];
  const presented = fromCookie ?? req.body?.refreshToken;

  if (typeof presented !== 'string' || !presented) {
    next(new AppError(401, 'MISSING_REFRESH_TOKEN', 'No refresh token supplied'));
    return;
  }

  try {
    const rotated = await rotateSession(presented);
    const accessToken = signAccessToken({
      sub: rotated.user.id,
      username: rotated.user.username,
      platformRole: rotated.user.platformRole,
    });

    const body = {
      accessToken,
      expiresAt: rotated.expiresAt,
      user: toPublicUser(rotated.user),
    };

    // browser only ever gets the refresh token as a cookie
    if (fromCookie) {
      setRefreshCookie(res, rotated.refreshToken, rotated.expiresAt);
      res.status(200).json(body);
    } else {
      res.status(200).json({ ...body, refreshToken: rotated.refreshToken });
    }
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
});

// no requireAuth here either
authRouter.post('/auth/logout', cookies, validateRequest(refreshTokenBodySchema), async (req, res, next) => {
  const presented: unknown = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;

  try {
    if (typeof presented === 'string' && presented) {
      await revokeSessionByToken(presented);
    }
    clearRefreshCookie(res);
    // always 204
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req.user!.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

// only registered when enabled
export const devLoginRouter = Router();
devLoginRouter.use('/auth', authRateLimiter);

devLoginRouter.post('/auth/dev-login', validateRequest(devLoginBodySchema), async (req, res, next) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!username) {
    next(new AppError(400, 'VALIDATION_ERROR', 'username is required'));
    return;
  }

  try {
    const result = await devLogin(username);
    setRefreshCookie(res, result.refreshToken, result.expiresAt);
    res.status(200).json({
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});
