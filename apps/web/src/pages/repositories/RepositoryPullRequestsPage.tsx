import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  GitPullRequest,
  GitMerge,
  MessageSquareWarning,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const pullRequests = [
  {
    id: 42,
    title: "Add repository health scoring",
    author: "Nethmi Bhagya",
    branch: "feature/health-score",
    score: 91,
    findings: 3,
    status: "Passed",
    time: "2 hours ago",
  },
  {
    id: 41,
    title: "Improve analysis worker performance",
    author: "Kasun Perera",
    branch: "perf/worker-optimization",
    score: 78,
    findings: 8,
    status: "Needs attention",
    time: "Yesterday",
  },
  {
    id: 40,
    title: "Update authentication flow",
    author: "Amaya Silva",
    branch: "feature/oauth",
    score: 96,
    findings: 1,
    status: "Passed",
    time: "2 days ago",
  },
];

export function RepositoryPullRequestsPage() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(`/repositories/${repoId}`)}
            className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={16} />
            Back to repository
          </button>

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-info/20 bg-info/10 px-3 py-1.5 text-xs font-medium text-info">
                <GitPullRequest size={13} />
                Pull request intelligence
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Pull Requests
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Review code quality results from analyzed pull requests.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Analyzed PRs",
              value: "128",
              icon: GitPullRequest,
              className: "bg-info/10 text-info",
            },
            {
              title: "Passed Quality Gate",
              value: "94",
              icon: CheckCircle2,
              className: "bg-success/10 text-success",
            },
            {
              title: "Needs Attention",
              value: "22",
              icon: MessageSquareWarning,
              className: "bg-warning/10 text-warning",
            },
            {
              title: "Average Score",
              value: "87.4",
              icon: Sparkles,
              className: "bg-primary/10 text-primary",
            },
          ].map((stat, index) => {
            const Icon = stat.icon;

            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl border border-border/70 bg-card p-5 hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.className}`}
                >
                  <Icon size={20} />
                </div>

                <p className="mt-5 text-sm text-muted-foreground">
                  {stat.title}
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {stat.value}
                </p>
              </motion.div>
            );
          })}
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card"
        >
          <div className="border-b border-border/70 p-5 sm:p-6">
            <p className="font-semibold">
              Recent Pull Requests
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Automated analysis results for recent pull requests.
            </p>
          </div>

          <div className="divide-y divide-border/60">
            {pullRequests.map((pr) => (
              <div
                key={pr.id}
                className="flex flex-col gap-5 p-5 transition hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
                    <GitPullRequest size={20} />
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold">
                      #{pr.id} {pr.title}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {pr.author} · {pr.branch}
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {pr.time}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Health Score
                    </p>

                    <p
                      className={`mt-1 text-xl font-bold ${
                        pr.score >= 85
                          ? "text-success"
                          : "text-warning"
                      }`}
                    >
                      {pr.score}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Findings
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {pr.findings}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                      pr.status === "Passed"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    {pr.status === "Passed" ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <ShieldAlert size={14} />
                    )}

                    {pr.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}