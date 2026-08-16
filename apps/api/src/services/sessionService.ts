import { randomUUID } from 'crypto';

import { prisma, type Session, type SessionRevokeReason, type User } from '@codehealth/db';

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { generateRefreshToken, hashRefreshToken } from '../lib/refreshToken';
import { AppError } from '../middleware/errorHandler';

// Two tabs restored at once both present the same token; whichever loses the
// race would look like a stolen token and kill the session. This window makes
// that a non-event, at the cost of a stolen token working for 10s longer.
const ROTATION_GRACE_MS = 10_000;

export interface IssuedSession {
  refreshToken: string;
  expiresAt: Date;
  user: User;
}

function expiryFromNow(): Date {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

// Adds a token to an existing family, keeping the family's original expiry so
// staying active can't extend a session forever.
async function issueInFamily(familyId: string, user: User, expiresAt: Date): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  await prisma.session.create({
    data: { familyId, userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt },
  });
  return { refreshToken, expiresAt, user };
}

export async function createSession(user: User): Promise<IssuedSession> {
  const issued = await issueInFamily(randomUUID(), user, expiryFromNow());
  // Logins are rare enough to piggyback the cleanup on; there's no scheduler yet.
  pruneExpiredSessions().catch((err) => logger.error({ err }, 'session prune failed'));
  return issued;
}

export async function revokeFamily(familyId: string, reason: SessionRevokeReason): Promise<number> {
  const { count } = await prisma.session.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return count;
}

export async function revokeAllUserSessions(
  userId: string,
  reason: SessionRevokeReason,
): Promise<number> {
  const { count } = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return count;
}

export async function pruneExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return count;
}

function isWithinGrace(session: Session): boolean {
  return (
    session.revokedReason === 'ROTATED' &&
    session.revokedAt !== null &&
    Date.now() - session.revokedAt.getTime() <= ROTATION_GRACE_MS
  );
}

/**
 * Spends a refresh token and returns its replacement. A token presented after
 * it was already spent means someone has a copy, so the whole family dies.
 */
export async function rotateSession(presentedToken: string): Promise<IssuedSession> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashRefreshToken(presentedToken) },
    include: { user: true },
  });

  if (!session) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is not valid');
  }

  if (session.revokedAt) {
    if (isWithinGrace(session)) {
      return issueInFamily(session.familyId, session.user, session.expiresAt);
    }

    if (session.revokedReason === 'ROTATED') {
      await revokeFamily(session.familyId, 'REUSE_DETECTED');
      logger.warn(
        { userId: session.userId, familyId: session.familyId },
        'refresh token reuse detected — family revoked',
      );
      throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token has already been used');
    }

    // Already dead for another reason (logout, admin, earlier reuse).
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is not valid');
  }

  if (session.expiresAt <= new Date()) {
    throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
  }

  if (!session.user.active) {
    await revokeFamily(session.familyId, 'USER_INACTIVE');
    throw new AppError(401, 'ACCOUNT_INACTIVE', 'This account is no longer active');
  }

  // Guarded on revokedAt so a concurrent refresh can't have its revocation
  // overwritten. A count of 0 means the other request won — issue anyway,
  // since logging the user out for opening two tabs is the worse failure.
  await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'ROTATED' },
  });

  return issueInFamily(session.familyId, session.user, session.expiresAt);
}

export async function revokeSessionByToken(presentedToken: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashRefreshToken(presentedToken) },
    select: { familyId: true },
  });
  if (session) {
    await revokeFamily(session.familyId, 'LOGOUT');
  }
}
