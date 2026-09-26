import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";

/*
 * =========================================================
 * AUTH CALLBACK PAGE
 * =========================================================
 *
 * Where the API drops the browser after a successful GitHub login. The code
 * exchange already happened server-side and the refresh cookie is set, so all
 * this page does is trade that cookie for an access token and move on.
 */

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { bootstrap } = useAuth();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The API redirects here with ?error= when the exchange fails.
    const failed = searchParams.get("error");
    if (failed) {
      setError(`GitHub sign in failed (${failed}). Please try again.`);
      return;
    }

    void bootstrap().then((ok) => {
      if (ok) {
        navigate("/dashboard", { replace: true });
      } else {
        setError("Could not complete sign in. Please try again.");
      }
    });
  }, [searchParams, bootstrap, navigate]);

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
