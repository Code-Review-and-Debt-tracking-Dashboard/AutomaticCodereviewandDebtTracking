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
import { requireAuth } from '../middleware/requireAuth';
import {
  buildGithubAuthorizeUrl,
  devLogin,
  getAuthenticatedUser,
  handleGithubCallback,
  toPublicUser,
} from '../services/authService';
import { revokeSessionByToken, rotateSession } from '../services/sessionService';

export const authRouter = Router();

// Only /auth/refresh and /auth/logout read cookies, and the cookie is scoped
// to /auth, so this stays off the rest of the app.
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

  // Single use either way — a failed login has to start over.
  clearStateCookie(res);

  try {
    const result = await handleGithubCallback(code, state, cookieNonce);

    // The mobile app can't use cookies, so it gets the tokens directly.
    if (result.client === 'native') {
      res.status(200).json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      return;
    }

    // Setting the cookie on a top-level navigation is what makes SameSite=Lax
    // work; an XHR here would be blocked once the app is deployed cross-site.
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

// No requireAuth — the whole point is that the access token has expired.
authRouter.post('/auth/refresh', cookies, async (req, res, next) => {
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

    // Answer on whichever transport asked, so a browser never receives the
    // refresh token anywhere JavaScript can read it.
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

// Also no requireAuth: an expired access token must not stop someone logging out.
authRouter.post('/auth/logout', cookies, async (req, res, next) => {
  const presented: unknown = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;

  try {
    if (typeof presented === 'string' && presented) {
      await revokeSessionByToken(presented);
    }
    clearRefreshCookie(res);
    // Always 204, so this can't be used to probe which tokens exist.
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

// Registered from app.ts only when enabled, so it can't exist in production.
export const devLoginRouter = Router();

devLoginRouter.post('/auth/dev-login', async (req, res, next) => {
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
