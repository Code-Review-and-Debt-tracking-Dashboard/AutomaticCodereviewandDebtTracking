import { createHash, randomBytes } from 'crypto';

// SHA-256 rather than bcrypt: this is 256 bits of random, not a password, so
// there's nothing to brute-force and we get an indexed lookup instead.
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
