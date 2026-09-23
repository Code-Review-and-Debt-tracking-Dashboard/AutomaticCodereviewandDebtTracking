import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { Logo } from "../../components/brand/Logo";
import { AlertIcon, CheckIcon } from "../../components/icons";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const SIGN_OUT_MESSAGES: Record<string, string> = {
  session_expired: "Your session has expired. Please log in again.",
  logged_out: "You have been logged out.",
};

const SECURITY_POINTS = [
  "No password stored by the dashboard",
  "Repository access controlled by GitHub",
  "Secure authenticated API requests",
];

// a month of health scores, just enough to show the shape of the product
const SAMPLE_TRACE = [58, 61, 57, 64, 62, 70, 68, 74, 79, 76, 83, 86, 84, 90, 92];

const TRACE_WIDTH = 520;
const TRACE_HEIGHT = 170;

function traceGeometry(scores: number[]) {
  const stepX = TRACE_WIDTH / (scores.length - 1);
  const toY = (score: number) => TRACE_HEIGHT - (score / 100) * TRACE_HEIGHT;

  const points = scores.map((score, index) => [index * stepX, toY(score)] as const);
  const line = points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");

  return {
    line: `M ${line}`,
    area: `M ${line} L ${TRACE_WIDTH} ${TRACE_HEIGHT} L 0 ${TRACE_HEIGHT} Z`,
    last: points[points.length - 1],
  };
}

function GithubMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.361-1.335-1.725-1.335-1.725-1.087-.731.084-.716.084-.716 1.205.082 1.838 1.215 1.838 1.215 1.07 1.803 2.809 1.282 3.495.981.108-.763.417-1.283.76-1.578-2.665-.295-5.466-1.309-5.466-5.827 0-1.287.465-2.339 1.235-3.164-.135-.298-.54-1.497.105-3.121 0 0 1.005-.316 3.3 1.209a11.5 11.5 0 0 1 3-.398c1.02.006 2.04.136 3 .398 2.28-1.525 3.285-1.209 3.285-1.209.645 1.624.24 2.823.12 3.121.765.825 1.23 1.877 1.23 3.164 0 4.53-2.805 5.527-5.475 5.817.42.354.81 1.077.81 2.182 0 1.578-.015 2.846-.015 3.229 0 .309.21.678.825.56C20.565 21.917 24 17.499 24 12.292 24 5.78 18.627.5 12 .5z" />
    </svg>
  );
}

export function LoginPage() {
  const { status, authLostReason } = useAuth();

  const handleGithubLogin = () => {
    window.location.href = `${API_URL}/auth/github`;
  };

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  const notice = authLostReason ? SIGN_OUT_MESSAGES[authLostReason] ?? null : null;

  const trace = traceGeometry(SAMPLE_TRACE);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-[1400px] lg:h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* ============ LEFT — the readout ============ */}
        <section className="relative hidden flex-col justify-between gap-10 overflow-y-auto border-r border-border px-12 py-10 lg:flex xl:px-16">
          <Logo size={30} />

          <div>
            <h1 className="max-w-xl font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] xl:text-[50px]">
              Every commit leaves
              <br />
              a trace. Read it.
            </h1>

            <p className="mt-5 max-w-md text-[15px] leading-7 text-muted-foreground">
              CodePulse runs the same static analysers on every pull request and
              turns the result into one health score you can actually defend.
            </p>

            {/* Health trace */}
            <figure className="mt-10 max-w-[520px]">
              <figcaption className="mb-3 flex items-baseline justify-between">
                <span className="eyebrow">Health score / 30 days</span>
                <span className="font-mono text-2xl font-semibold text-primary">
                  {SAMPLE_TRACE[SAMPLE_TRACE.length - 1]}
                </span>
              </figcaption>

              <svg
                viewBox={`0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}`}
                className="w-full overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="trace-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[0, 25, 50, 75].map((value) => (
                  <line
                    key={value}
                    x1="0"
                    x2={TRACE_WIDTH}
                    y1={TRACE_HEIGHT - (value / 100) * TRACE_HEIGHT}
                    y2={TRACE_HEIGHT - (value / 100) * TRACE_HEIGHT}
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                  />
                ))}

                <motion.path
                  d={trace.area}
                  fill="url(#trace-fill)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.6 }}
                />

                <motion.path
                  d={trace.line}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.4, ease: "easeInOut" }}
                />

                <motion.circle
                  cx={trace.last[0]}
                  cy={trace.last[1]}
                  r="4"
                  fill="hsl(var(--primary))"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.3, type: "spring", stiffness: 300 }}
                />
              </svg>
            </figure>
          </div>

          <div className="flex gap-8 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Rule-based analysis</span>
            <span>Reproducible scoring</span>
            <span>GitHub native</span>
          </div>
        </section>

        {/* ============ RIGHT — sign in ============ */}
        <section className="flex items-center justify-center overflow-y-auto px-6 py-12 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm"
          >
            <div className="mb-10 lg:hidden">
              <Logo size={30} />
            </div>

            <p className="eyebrow">Sign in</p>

            <h2 className="mt-2.5 font-display text-[26px] font-semibold tracking-[-0.02em]">
              Welcome back
            </h2>

            <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
              Connect your GitHub account to start monitoring your repositories.
            </p>

            {notice && (
              <p className="mt-6 flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-5 text-warning">
                <AlertIcon size={15} className="mt-px shrink-0" />
                {notice}
              </p>
            )}

            <button
              type="button"
              onClick={handleGithubLogin}
              className="group mt-7 flex h-11 w-full items-center justify-center gap-2.5 rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <GithubMark />
              Continue with GitHub
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>

            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="eyebrow text-[10px]">Secure authentication</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <ul className="space-y-2.5">
              {SECURITY_POINTS.map((text) => (
                <li
                  key={text}
                  className="flex items-center gap-2.5 text-xs text-muted-foreground"
                >
                  <CheckIcon size={14} className="shrink-0 text-primary" />
                  {text}
                </li>
              ))}
            </ul>

            <p className="mt-10 font-mono text-[10px] uppercase leading-5 tracking-[0.1em] text-muted-foreground">
              Continuing authorises the GitHub permissions required for
              repository analysis.
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
