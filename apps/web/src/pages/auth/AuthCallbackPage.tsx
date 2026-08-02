import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/apiClient";
import type { AuthUser } from "../../contexts/AuthContext";

/*
 * =========================================================
 * AUTH CALLBACK PAGE (D-04b)
 * =========================================================
 *
 * Handles the GitHub OAuth redirect back to the web application.
 * Reads `code` and `state` from URL search parameters and calls
 * `GET /auth/github/callback` on the backend API.
 *
 * On success: logs in through AuthContext and navigates to /dashboard.
 * On failure: renders an error message with a retry option.
 */

interface CallbackResponse {
  token: string;
  user: AuthUser;
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setError("Missing code or state parameters from GitHub redirect.");
      return;
    }

    const processCallback = async () => {
      try {
        const response = await api.get<CallbackResponse>(
          `/auth/github/callback`,
          { code, state }
        );

        login(response.token, response.user);
        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          "Authentication failed. Please try logging in again.";
        setError(msg);
      }
    };

    processCallback();
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-xl text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle size={24} />
          </div>

          <h2 className="text-xl font-bold text-foreground">
            Authentication Failed
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">{error}</p>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <Loader2 size={36} className="text-primary" />
        </motion.div>

        <p className="text-sm font-medium text-muted-foreground">
          Completing sign in with GitHub…
        </p>
      </motion.div>
    </div>
  );
}
