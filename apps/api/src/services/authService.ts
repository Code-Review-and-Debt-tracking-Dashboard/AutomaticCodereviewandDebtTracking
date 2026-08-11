import { prisma } from '@codehealth/db';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';

import { env } from '../config/env';
import { encrypt } from '../lib/crypto';
import { type OAuthClient, signAccessToken, signState, verifyState } from '../lib/jwt';
import { consumeStateNonce } from '../lib/oauthStateStore';
import { AppError } from '../middleware/errorHandler';
import { syncUserOrganizations } from './orgService';
import { createSession } from './sessionService';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
// read:org covers private org memberships too
const GITHUB_OAUTH_SCOPE = 'repo,user:email,read:org';

export interface PublicUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  platformRole: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  client: OAuthClient;
  redirectTo?: string;
  user: PublicUser;
}

// relative paths only, otherwise this is an open redirect
function sanitizeRedirect(redirect: unknown): string | undefined {
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : undefined;
}

// Returns the nonce too, so the caller can put it in a cookie and bind the
// login to this browser.
export function buildGithubAuthorizeUrl(
  redirect?: unknown,
  client: OAuthClient = 'web',
): { url: string; nonce: string } {
  const { state, nonce } = signState(sanitizeRedirect(redirect), client);

  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', env.githubClientId);
  url.searchParams.set('redirect_uri', env.githubOAuthCallbackUrl);
  url.searchParams.set('scope', GITHUB_OAUTH_SCOPE);
  url.searchParams.set('state', state);

  return { url: url.toString(), nonce };
}

interface GithubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function exchangeCodeForToken(code: string): Promise<GithubTokenResponse> {
  let response: Response;
  try {
    response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.githubClientId,
        client_secret: env.githubClientSecret,
        code,
        redirect_uri: env.githubOAuthCallbackUrl,
      }),
    });
  } catch (err) {
    throw new AppError(502, 'GITHUB_UNAVAILABLE', 'Could not reach GitHub to exchange the OAuth code');
  }

  if (!response.ok) {
    throw new AppError(502, 'GITHUB_UNAVAILABLE', 'GitHub returned an error during token exchange');
  }

  return (await response.json()) as GithubTokenResponse;
}

export async function handleGithubCallback(
  code: string | undefined,
  state: string | undefined,
  cookieNonce: string | undefined,
): Promise<AuthResult> {
  if (!code) {
    throw new AppError(400, 'INVALID_CODE', 'Missing "code" query parameter');
  }
  if (!state) {
    throw new AppError(400, 'INVALID_STATE', 'Missing "state" query parameter');
  }

  let statePayload;
  try {
    statePayload = verifyState(state);
  } catch {
    throw new AppError(400, 'INVALID_STATE', 'OAuth "state" is invalid or expired');
  }

  // Without this, any validly-signed state is accepted from any browser, so an
  // attacker could hand a victim a login that lands in the attacker's account.
  if (!cookieNonce || cookieNonce !== statePayload.nonce) {
    throw new AppError(400, 'INVALID_STATE', 'OAuth "state" did not start in this browser');
  }

  const isFirstUse = await consumeStateNonce(statePayload.nonce);
  if (!isFirstUse) {
    throw new AppError(400, 'INVALID_STATE', 'OAuth "state" has already been used');
  }

  const tokenResponse = await exchangeCodeForToken(code);
  if (tokenResponse.error || !tokenResponse.access_token) {
    throw new AppError(
      400,
      'INVALID_CODE',
      tokenResponse.error_description || 'GitHub rejected the provided authorization code',
    );
  }

  const accessToken = tokenResponse.access_token;
  const octokit = new Octokit({ auth: accessToken });

  let githubUser: RestEndpointMethodTypes['users']['getAuthenticated']['response']['data'];
  let primaryEmail: string | null;
  try {
    const { data } = await octokit.rest.users.getAuthenticated();
    githubUser = data;

    primaryEmail = data.email ?? null;
    if (!primaryEmail) {
      const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
      primaryEmail = emails.find((e) => e.primary && e.verified)?.email ?? null;
    }
  } catch {
    throw new AppError(502, 'GITHUB_UNAVAILABLE', 'Could not fetch the GitHub user profile');
  }

  const encryptedAccessToken = encrypt(accessToken);

  const user = await prisma.$transaction(async (tx) => {
    const savedUser = await tx.user.upsert({
      where: { githubId: String(githubUser.id) },
      update: {
        username: githubUser.login,
        email: primaryEmail,
        avatarUrl: githubUser.avatar_url,
      },
      create: {
        githubId: String(githubUser.id),
        username: githubUser.login,
        email: primaryEmail,
        avatarUrl: githubUser.avatar_url,
      },
    });

    await tx.gitHubCredential.upsert({
      where: { userId: savedUser.id },
      update: {
        encryptedAccessToken,
        tokenType: tokenResponse.token_type ?? null,
        scope: tokenResponse.scope ?? null,
      },
      create: {
        userId: savedUser.id,
        encryptedAccessToken,
        tokenType: tokenResponse.token_type ?? null,
        scope: tokenResponse.scope ?? null,
      },
    });

    return savedUser;
  });

  // org membership comes from GitHub, so refresh it on every login
  await syncUserOrganizations(
    user.id,
    {
      githubId: String(githubUser.id),
      login: githubUser.login,
      name: githubUser.name,
      avatarUrl: githubUser.avatar_url,
    },
    accessToken,
  );

  const { refreshToken, expiresAt } = await createSession(user);
  const appAccessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    platformRole: user.platformRole,
  });

  return {
    accessToken: appAccessToken,
    refreshToken,
    expiresAt,
    client: statePayload.client,
    redirectTo: statePayload.redirect,
    user: toPublicUser(user),
  };
}

export function toPublicUser(user: {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  platformRole: string;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    platformRole: user.platformRole,
  };
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  user: PublicUser;
}

// Local-only sign-in for people without GitHub OAuth credentials configured.
// Goes through the same session path as a real login so it exercises it.
export async function devLogin(username: string): Promise<SessionTokens> {
  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { githubId: `dev-${username}`, username, email: `${username}@dev.local` },
  });

  const { refreshToken, expiresAt } = await createSession(user);
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    platformRole: user.platformRole,
  });

  return { accessToken, refreshToken, expiresAt, user: toPublicUser(user) };
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  platformRole: string;
  createdAt: Date;
}

// A token can outlive the user row, so a missing user is a 401, not a 404.
export async function getAuthenticatedUser(userId: string): Promise<CurrentUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid auth token');
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    platformRole: user.platformRole,
    createdAt: user.createdAt,
  };
}
