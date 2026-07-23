import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  GitPullRequest,
  LockKeyhole,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";

export function RepositoryQualityGatePage() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  const [enabled, setEnabled] = useState(true);
  const [minimumScore, setMinimumScore] = useState(80);
  const [maxCritical, setMaxCritical] = useState(0);
  const [maxHigh, setMaxHigh] = useState(5);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        <button
          onClick={() => navigate(`/repositories/${repoId}`)}
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Back to repository
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <ShieldCheck size={13} />
            Automated quality control
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Quality Gate
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Define the conditions that code must satisfy before it can be
            merged.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6"
          >
            <div className="flex items-center justify-between border-b border-border/70 pb-5">
              <div>
                <p className="font-semibold">
                  Quality Gate Rules
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Configure repository quality requirements.
                </p>
              </div>

              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative h-6 w-11 rounded-full transition ${
                  enabled ? "bg-success" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                    enabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="space-y-6 pt-6">

              <div>
                <label className="text-sm font-medium">
                  Minimum Health Score
                </label>

                <p className="mt-1 text-xs text-muted-foreground">
                  Pull requests below this score will fail the quality gate.
                </p>

                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minimumScore}
                  onChange={(event) =>
                    setMinimumScore(Number(event.target.value))
                  }
                  className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Maximum Critical Findings
                </label>

                <input
                  type="number"
                  min={0}
                  value={maxCritical}
                  onChange={(event) =>
                    setMaxCritical(Number(event.target.value))
                  }
                  className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Maximum High Findings
                </label>

                <input
                  type="number"
                  min={0}
                  value={maxHigh}
                  onChange={(event) =>
                    setMaxHigh(Number(event.target.value))
                  }
                  className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                />
              </div>

              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
                <Save size={17} />
                Save Quality Gate
              </button>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
              <CheckCircle2 size={24} />
            </div>

            <p className="mt-5 text-lg font-semibold">
              Current Status
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              The current repository configuration satisfies all quality gate
              conditions.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-sm">
                  Minimum score
                </span>

                <span className="font-semibold">
                  {minimumScore}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-sm">
                  Critical findings
                </span>

                <span className="font-semibold">
                  ≤ {maxCritical}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-sm">
                  High findings
                </span>

                <span className="font-semibold">
                  ≤ {maxHigh}
                </span>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}