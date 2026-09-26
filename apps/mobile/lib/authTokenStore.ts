let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

type AuthLostListener = (reason: string) => void;

const listeners = new Set<AuthLostListener>();

export function onAuthLost(listener: AuthLostListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAuthLost(reason: string): void {
  listeners.forEach((l) => l(reason));
}
