import { createHash, randomBytes } from 'crypto';

// sha256 is enough, it's random not a password
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
