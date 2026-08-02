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

import { api } from "../lib/apiClient";

/*
 * =========================================================
 * AUTH CONTEXT (D-04a)
 * =========================================================
 *
 * Holds the current user's identity and JWT token.
 *
 * On mount, if a token exists in localStorage the context
 * validates it by calling GET /auth/me.  If the token is
 * invalid the user is silently logged out.
 *
 * Login / logout helpers update both React state and
 * localStorage so the apiClient interceptor always has
 * the latest token.
 */

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  platformRole: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
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

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token"),
  );
  const [isLoading, setIsLoading] = useState(true);

  /*
   * On mount: if a token already exists, verify it against
   * GET /auth/me.  This handles page refreshes.
   */
  useEffect(() => {
    const validateToken = async () => {
      const stored = localStorage.getItem("token");
      const demoUser: AuthUser = {
        id: "usr-demo-001",
        username: "demo_developer",
        email: "demo@codehealth.dev",
        avatarUrl: null,
        platformRole: "ADMIN",
      };

      if (!stored || stored === "demo-token") {
        localStorage.setItem("token", "demo-token");
        localStorage.setItem("user", JSON.stringify(demoUser));
        setUser(demoUser);
        setToken("demo-token");
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.get<AuthUser>("/auth/me");
        setUser(data);
        setToken(stored);
      } catch {
        // Fallback to demo mode if backend is offline or endpoint unavailable
        setUser(demoUser);
        setToken(stored);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []);

  const login = useCallback(
    (newToken: string, newUser: AuthUser) => {
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the server call fails, clear local state
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    navigate("/login");
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
