import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { api, refreshAccessToken } from "../lib/apiClient";
import { onAuthLost, setAccessToken } from "../lib/authTokenStore";

// token is in memory only, so on mount we get a new one from the refresh cookie

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  platformRole: string;
}

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** e.g. REFRESH_TOKEN_REUSED */
  authLostReason: string | null;
  bootstrap: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

interface AuthProviderProps {
  children: ReactNode;
}

// old demo-token leftovers
function clearLegacyStorage(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authLostReason, setAuthLostReason] = useState<string | null>(null);

  const bootstrap = useCallback(async (): Promise<boolean> => {
    try {
      await refreshAccessToken();
      const me = await api.get<AuthUser>("/auth/me");
      setUser(me);
      setStatus("authenticated");
      setAuthLostReason(null);
      return true;
    } catch {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
      return false;
    }
  }, []);

  useEffect(() => {
    clearLegacyStorage();
    void bootstrap();
  }, [bootstrap]);

  // failed refresh mid-session
  useEffect(
    () =>
      onAuthLost((reason) => {
        setAccessToken(null);
        setUser(null);
        setStatus("anonymous");
        setAuthLostReason(reason);
      }),
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // clear local state anyway
    }

    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
    setAuthLostReason(null);
    navigate("/login");
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
      isLoading: status === "loading",
      authLostReason,
      bootstrap,
      logout,
    }),
    [user, status, authLostReason, bootstrap, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
