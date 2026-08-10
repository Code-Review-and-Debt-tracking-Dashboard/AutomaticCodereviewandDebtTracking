/*
 * The access token is kept in memory, not localStorage, so an XSS can't walk
 * off with a durable credential. It's gone on reload — AuthContext gets a new
 * one from the refresh cookie on mount.
 *
 * Lives outside React so apiClient can read it without importing components.
 */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

type AuthLostListener = (reason: string) => void;

const listeners = new Set<AuthLostListener>();

/** Lets AuthContext react when a refresh fails, instead of a hard redirect. */
export function onAuthLost(listener: AuthLostListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAuthLost(reason: string): void {
  listeners.forEach((l) => l(reason));
}
