import type { User } from '@codehealth/db';

import { signAccessToken, signState } from '../../src/lib/jwt';

type TokenUser = Pick<User, 'id' | 'username' | 'platformRole'>;

// Same signer the API uses. There is no org claim in the token — org scope
// is resolved per request from OrganizationMember rows — so a token on its
// own never grants access to anything; memberships have to be seeded.
export function tokenFor(user: TokenUser): string {
  return signAccessToken({ sub: user.id, username: user.username, platformRole: user.platformRole });
}

export function bearer(user: TokenUser): { Authorization: string } {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

// A validly signed JWT that is not an access token. requireAuth must reject it.
export function stateTokenAsBearer(): { Authorization: string } {
  return { Authorization: `Bearer ${signState(undefined, 'web').state}` };
}
