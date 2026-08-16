import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { buildGithubAuthorizeUrl, getAuthenticatedUser, handleGithubCallback } from '../services/authService';

export const authRouter = Router();

authRouter.get('/auth/github', (req, res) => {
  const url = buildGithubAuthorizeUrl(req.query.redirect);
  res.redirect(url);
});

authRouter.get('/auth/github/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;

    const result = await handleGithubCallback(code, state);

    if (!result.redirect) {
      res.status(200).send('Login successful. You can close this window.');
      return;
    }

    const url = `${result.redirect}?token=${encodeURIComponent(result.token)}`;
    res.redirect(url);
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

// JWT is stateless, so there's nothing to invalidate server-side
authRouter.post('/auth/logout', requireAuth, (_req, res) => {
  res.status(204).end();
});
