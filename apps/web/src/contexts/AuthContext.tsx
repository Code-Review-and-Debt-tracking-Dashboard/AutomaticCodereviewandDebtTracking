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

/*
 * =========================================================
 * AUTH CONTEXT
 * =========================================================
 *
 * The access token lives in memory only, so a reload starts with nothing.
 * On mount we trade the refresh cookie for a new access token; if that fails
 * the visitor is simply anonymous.
 *
 * `status` starts as "loading" so ProtectedRoute shows a spinner rather than
 * flashing the login page before we know.
 */

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
  /** Set when the session ended unexpectedly, e.g. REFRESH_TOKEN_REUSED. */
  authLostReason: string | null;
  /** Pulls a fresh session from the refresh cookie. Used after OAuth too. */
  bootstrap: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

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

// Left over from the old demo-token mode; drop it so nobody debugs a ghost.
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
      // Shared single-flight, so StrictMode's double effect is still one call.
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

  // A failed refresh mid-session lands here rather than reloading the page.
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
      // Even if the server call fails, clear local state
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
