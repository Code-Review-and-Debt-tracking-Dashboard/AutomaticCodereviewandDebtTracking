import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import {
  api,
  API_BASE_URL,
  getStoredRefreshToken,
  refreshAccessToken,
  setStoredRefreshToken,
} from '../lib/apiClient';
import { onAuthLost, setAccessToken } from '../lib/authTokenStore';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  platformRole: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore a persisted session on app start by refreshing rather than
  // trusting a stored access token — access tokens are short-lived (15 min),
  // so a token surviving a cold start is almost always already expired.
  useEffect(() => {
    const restore = async () => {
      const stored = await getStoredRefreshToken();
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        await refreshAccessToken();
        const me = await api.get<AuthUser>('/auth/me');
        setUser(me);
      } catch {
        setAccessToken(null);
        await setStoredRefreshToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  // A failed refresh mid-session (triggered by any api.* call, not just this
  // file) lands here instead of the caller having to handle it individually.
  useEffect(
    () =>
      onAuthLost(() => {
        setUser(null);
      }),
    [],
  );

  const login = useCallback(async () => {
    const redirectUrl = Linking.createURL('auth');
    const authUrl = `${API_BASE_URL}/auth/github?client=native&redirect=${encodeURIComponent(redirectUrl)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== 'success') {
      return;
    }

    const { queryParams } = Linking.parse(result.url);
    const accessToken = queryParams?.accessToken;
    const refreshToken = queryParams?.refreshToken;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      return;
    }

    setAccessToken(accessToken);
    await setStoredRefreshToken(refreshToken);

    try {
      const me = await api.get<AuthUser>('/auth/me');
      setUser(me);
    } catch {
      setAccessToken(null);
      await setStoredRefreshToken(null);
    }
  }, []);

  const logout = useCallback(async () => {
    const stored = await getStoredRefreshToken();
    try {
      if (stored) {
        await api.post('/auth/logout', { refreshToken: stored });
      }
    } catch {
      // Even if the server call fails, clear local state
    }

    setAccessToken(null);
    await setStoredRefreshToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
