import { prisma } from '@codehealth/db';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';

import { env } from '../config/env';
import { encrypt } from '../lib/crypto';
import { signAppJwt, signState, verifyState } from '../lib/jwt';
import { consumeStateNonce } from '../lib/oauthStateStore';
import { AppError } from '../middleware/errorHandler';
import { syncUserOrganizations } from './orgService';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
// read:org covers private org memberships too
const GITHUB_OAUTH_SCOPE = 'repo,user:email,read:org';

export interface AuthResult {
  token: string;
  redirect?: string;
  user: {
    id: string;
    username: string;
    email: string | null;
    avatarUrl: string | null;
    platformRole: string;
  };
}


const MOBILE_SCHEME = 'codehealth://'; // matches "scheme" in apps/mobile/app.json

// relative paths or the mobile app's own scheme only, otherwise this is an open redirect
function sanitizeRedirect(redirect: unknown): string | undefined {
  if (typeof redirect !== 'string') return undefined;
  if (redirect.startsWith('/') || redirect.startsWith(MOBILE_SCHEME)) {
    return redirect;
  }
  return undefined;
}

export function buildGithubAuthorizeUrl(redirect?: unknown): string {
  const state = signState(sanitizeRedirect(redirect));

  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', env.githubClientId);
  url.searchParams.set('redirect_uri', env.githubOAuthCallbackUrl);
  url.searchParams.set('scope', GITHUB_OAUTH_SCOPE);
  url.searchParams.set('state', state);

  return url.toString();
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

  const isFirstUse = await consumeStateNonce(statePayload.nonce);
  if (!isFirstUse) {
    throw new AppError(400, 'INVALID_STATE', 'OAuth "state" has already been used');
  }

  const redirect = statePayload.redirect;

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

  const token = signAppJwt({ sub: user.id, username: user.username, platformRole: user.platformRole });

  return {
    token,
    redirect,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      platformRole: user.platformRole,
    },
  };
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
