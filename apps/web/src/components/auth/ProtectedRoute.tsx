import { Navigate, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";

/*
 * =========================================================
 * PROTECTED ROUTE WRAPPER (D-04a)
 * =========================================================
 *
 * Wraps any <Route> that requires authentication.
 *
 * - While the auth token is being validated → loading spinner
 * - If not authenticated → redirect to /login
 * - If authenticated → render child routes via <Outlet />
 */

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
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
            <Loader2
              size={32}
              className="text-primary"
            />
          </motion.div>

          <p className="text-sm text-muted-foreground">
            Verifying authentication…
          </p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
}
