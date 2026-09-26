import type { User } from '@codehealth/db';

import { signAccessToken, signState } from '../../src/lib/jwt';

type TokenUser = Pick<User, 'id' | 'username' | 'platformRole'>;

// token alone gives no org access, memberships have to be seeded
export function tokenFor(user: TokenUser): string {
  return signAccessToken({ sub: user.id, username: user.username, platformRole: user.platformRole });
}

export function bearer(user: TokenUser): { Authorization: string } {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

// signed but not an access token
export function stateTokenAsBearer(): { Authorization: string } {
  return { Authorization: `Bearer ${signState(undefined, 'web').state}` };
}
