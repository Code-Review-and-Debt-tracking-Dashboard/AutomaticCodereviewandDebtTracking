import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { buildGithubAuthorizeUrl, getAuthenticatedUser, handleGithubCallback } from '../services/authService';

export const authRouter = Router();

// GET /auth/github — api_design.md §1: redirects to the GitHub OAuth consent screen.
authRouter.get('/auth/github', (req, res) => {
  const url = buildGithubAuthorizeUrl(req.query.redirect);
  res.redirect(url);
});

// GET /auth/github/callback — api_design.md §1: exchanges code for a token,
// creates/updates the user, and returns { token, user }.
authRouter.get('/auth/github/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;

    const result = await handleGithubCallback(code, state);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /auth/me — api_design.md §1: returns the currently authenticated user.
authRouter.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req.user!.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout — api_design.md §1: stateless JWT, so there is no
// server-side session to invalidate; the guard already rejects missing/
// invalid tokens with 401 before this handler runs.
authRouter.post('/auth/logout', requireAuth, (_req, res) => {
  res.status(204).end();
});
