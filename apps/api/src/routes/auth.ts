import { Router } from 'express';

import { buildGithubAuthorizeUrl, handleGithubCallback } from '../services/authService';

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
