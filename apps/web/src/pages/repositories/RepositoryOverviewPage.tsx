import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock3,
  Code2,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { Loader2 } from "lucide-react";

interface RepoDetail {
  id: string;
  name: string;
  fullName: string;
  language: string | null;
  defaultBranch: string;
  htmlUrl?: string;
  private?: boolean;
  healthScore?: number;
  openFindings?: number;
  debtMinutes?: number;
}

function RepositoryOverviewPageData() {
  const { repoId } = useParams<{ repoId: string }>();
  const [repo, setRepo] = useState<RepoDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await api.get<RepoDetail>(`/api/repos/${repoId}`);
        setRepo(res);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load repository detail.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [repoId]);

  const repository = {
    id: repo?.id || repoId || "repo-001",
    name: repo?.name || "Repository",
    fullName: repo?.fullName || "org/repo",
    owner: repo?.fullName ? repo.fullName.split("/")[0] : "org",
    language: repo?.language || "TypeScript",
    defaultBranch: repo?.defaultBranch || "main",
    githubUrl: repo?.htmlUrl || "#",
    isPrivate: repo?.private ?? false,
    healthScore: repo?.healthScore ?? 86,
    totalFindings: repo?.openFindings ?? 24,
    technicalDebt: repo?.debtMinutes ? `${Math.floor(repo.debtMinutes / 60)}h ${repo.debtMinutes % 60}m` : "4h 20m",
  };

  return null;
}


/*
|--------------------------------------------------------------------------
| MOCK HEALTH TREND
|--------------------------------------------------------------------------
| BACKEND IMPLEMENTATION LATER
|
| GET /api/repos/:repoId/health-trend?period=30d
|
| This data will eventually come from:
|
| AnalysisSnapshot[]
|
| Database concept:
|
| Repository
|     ↓
| Analysis
|     ↓
| AnalysisSnapshot
|
|--------------------------------------------------------------------------
*/

const healthTrend = [
  { date: "Jun 01", score: 68 },
  { date: "Jun 05", score: 71 },
  { date: "Jun 10", score: 70 },
  { date: "Jun 15", score: 76 },
  { date: "Jun 20", score: 79 },
  { date: "Jun 25", score: 82 },
  { date: "Jun 30", score: 86 },
];

/*
|--------------------------------------------------------------------------
| MOCK METRIC DATA
|--------------------------------------------------------------------------
| BACKEND IMPLEMENTATION LATER
|
| These values are calculated by the Worker service.
|
| Example:
|
| ESLint       → Code Smells
| Radon        → Complexity
| jscpd        → Duplication
| Bandit       → Security
| Pylint       → Maintainability
|
| GET /api/repos/:repoId/analyses/latest
|--------------------------------------------------------------------------
*/

const metrics = [
  {
    title: "Code Smells",
    value: "12",
    change: "-8%",
    description: "Detected issues",
    icon: AlertTriangle,
    iconClass: "bg-warning/10 text-warning",
    trend: "down",
  },
  {
    title: "Complexity",
    value: "18",
    change: "+3%",
    description: "High complexity areas",
    icon: TrendingUp,
    iconClass: "bg-info/10 text-info",
    trend: "up",
  },
  {
    title: "Security",
    value: "2",
    change: "-50%",
    description: "Security findings",
    icon: ShieldAlert,
    iconClass: "bg-danger/10 text-danger",
    trend: "down",
  },
  {
    title: "Technical Debt",
    value: "4h 20m",
    change: "-6h",
    description: "Estimated remediation",
    icon: Wrench,
    iconClass: "bg-primary/10 text-primary",
    trend: "down",
  },
];

/*
|--------------------------------------------------------------------------
| MOCK RECENT ACTIVITY
|--------------------------------------------------------------------------
| BACKEND IMPLEMENTATION LATER
|
| GET /api/repos/:repoId/activity
|
| Could later be generated from:
|
| - Analysis
| - PullRequest
| - Finding
| - Notification
|--------------------------------------------------------------------------
*/

const recentActivity = [
  {
    title: "Analysis completed",
    description: "Latest analysis completed successfully",
    time: "8 minutes ago",
    icon: CheckCircle2,
    iconClass: "bg-success/10 text-success",
  },
  {
    title: "Pull request analyzed",
    description: "PR #42 introduced 3 new findings",
    time: "32 minutes ago",
    icon: GitPullRequest,
    iconClass: "bg-info/10 text-info",
  },
  {
    title: "Security finding detected",
    description: "Potential security issue found in API service",
    time: "1 hour ago",
    icon: ShieldAlert,
    iconClass: "bg-danger/10 text-danger",
  },
];

export function RepositoryOverviewPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const [repoDetail, setRepoDetail] = useState<RepoDetail | null>(null);
  const [trendPoints, setTrendPoints] = useState<{ date: string; score: number }[]>([]);
  const [debtData, setDebtData] = useState<{ totalDebtMinutes: number; debtDelta: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!repoId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [repoRes, trendRes, debtRes] = await Promise.allSettled([
          api.get<RepoDetail>(`/api/repos/${repoId}`),
          api.get<{ dataPoints: { date: string; healthScore: number }[] }>(`/api/repos/${repoId}/trend?days=30`),
          api.get<{ totalDebtMinutes: number; debtDelta: number }>(`/api/repos/${repoId}/debt`),
        ]);

        if (repoRes.status === "fulfilled") {
          setRepoDetail(repoRes.value);
        }
        if (trendRes.status === "fulfilled" && trendRes.value?.dataPoints) {
          setTrendPoints(
            trendRes.value.dataPoints.map((dp) => ({
              date: new Date(dp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              score: dp.healthScore,
            }))
          );
        }
        if (debtRes.status === "fulfilled") {
          setDebtData(debtRes.value);
        }
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [repoId]);

  const repository = {
    id: repoDetail?.id || repoId || "repo-001",
    name: repoDetail?.name || "code-health-demo",
    fullName: repoDetail?.fullName || "seed-acme/code-health-demo",
    owner: repoDetail?.fullName ? repoDetail.fullName.split("/")[0] : "seed-acme",
    language: repoDetail?.language || "TypeScript",
    defaultBranch: repoDetail?.defaultBranch || "main",
    githubUrl: repoDetail?.htmlUrl || "https://github.com",
    isPrivate: repoDetail?.private ?? false,
    healthScore: repoDetail?.healthScore ?? 88,
    totalFindings: repoDetail?.openFindings ?? 5,
    technicalDebt: debtData?.totalDebtMinutes
      ? `${Math.floor(debtData.totalDebtMinutes / 60)}h ${debtData.totalDebtMinutes % 60}m`
      : "1h 35m",
    debtDelta: debtData?.debtDelta ?? -5,
  };

  const chartTrend = trendPoints.length > 0 ? trendPoints : healthTrend;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {/* ================================================================
            HEADER
        ================================================================= */}

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Repositories</span>
            <span>/</span>
            <span className="text-foreground">
              {repository.name}
            </span>
          </div>

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Sparkles size={13} />
                Repository intelligence
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {repository.name}
                </h1>

                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  Healthy
                </span>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {repository.fullName}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Code2 size={14} />
                  {repository.language}
                </span>

                <span className="flex items-center gap-1.5">
                  <GitBranch size={14} />
                  {repository.defaultBranch}
                </span>

                <span className="flex items-center gap-1.5">
                  <Clock3 size={14} />
                  Last analyzed 8 minutes ago
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* BACKEND LATER:
                  Trigger POST /api/repos/:repoId/analyze
              */}
              <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-primary/40 hover:bg-muted">
                <TrendingUp size={17} />
                Run analysis
              </button>

              <a
                href={repository.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
              >
                <ExternalLink size={17} />
                GitHub
              </a>
            </div>
          </div>
        </motion.div>

        {/* ================================================================
            TOP SUMMARY CARDS
        ================================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Health Score"
            value={`${repository.healthScore}`}
            description="Overall repository quality"
            icon={CheckCircle2}
            iconClass="bg-success/10 text-success"
            change="+18 points"
            changeType="positive"
          />

          <SummaryCard
            title="Open Findings"
            value={`${repository.totalFindings}`}
            description="Issues requiring attention"
            icon={ShieldAlert}
            iconClass="bg-warning/10 text-warning"
            change="-8 this week"
            changeType="positive"
          />

          <SummaryCard
            title="Technical Debt"
            value={repository.technicalDebt}
            description="Estimated remediation effort"
            icon={Wrench}
            iconClass="bg-primary/10 text-primary"
            change="-6h this week"
            changeType="positive"
          />

          <SummaryCard
            title="Pull Requests"
            value="42"
            description="Analyzed pull requests"
            icon={GitPullRequest}
            iconClass="bg-info/10 text-info"
            change="+5 this week"
            changeType="positive"
          />
        </div>

        {/* ================================================================
            HEALTH CHART + RECENT ACTIVITY
        ================================================================= */}

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">
                  Health Score Trend
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Repository health over the last 30 days
                </p>
              </div>

              <div className="text-right">
                <p className="text-2xl font-bold">
                  {repository.healthScore}
                </p>

                <p className="flex items-center justify-end gap-1 text-xs text-success">
                  <ArrowUpRight size={14} />
                  +18 points
                </p>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTrend}>
                  <defs>
                    <linearGradient
                      id="repositoryHealthGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.35}
                      />

                      <stop
                        offset="100%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#repositoryHealthGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          {/* RECENT ACTIVITY */}

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6"
          >
            <div className="mb-6">
              <p className="text-sm font-semibold">
                Recent Activity
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Latest repository events
              </p>
            </div>

            <div className="space-y-5">
              {recentActivity.map((activity) => {
                const Icon = activity.icon;

                return (
                  <div
                    key={activity.title}
                    className="flex gap-3"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${activity.iconClass}`}
                    >
                      <Icon size={16} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {activity.title}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {activity.description}
                      </p>

                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        </div>

        {/* ================================================================
            QUALITY METRICS
        ================================================================= */}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 rounded-2xl border border-border/70 bg-card p-5 sm:p-6"
        >
          <div className="mb-6">
            <p className="text-sm font-semibold">
              Quality Metrics
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Latest static analysis results
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div
                  key={metric.title}
                  className="rounded-2xl border border-border/60 bg-background/40 p-4 transition hover:border-primary/30 hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.iconClass}`}
                    >
                      <Icon size={18} />
                    </div>

                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <ArrowDownRight size={13} />
                      {metric.change}
                    </span>
                  </div>

                  <p className="mt-4 text-sm font-semibold">
                    {metric.title}
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {metric.value}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ================================================================
            ANALYSIS INFORMATION
        ================================================================= */}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 rounded-2xl border border-border/70 bg-card p-5 sm:p-6"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold">
                Latest Analysis
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Analysis completed successfully 8 minutes ago
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar size={14} />
              June 30, 2026
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <AnalysisInfo
              label="Files analyzed"
              value="248"
            />

            <AnalysisInfo
              label="Lines of code"
              value="42,891"
            />

            <AnalysisInfo
              label="Analysis duration"
              value="2m 34s"
            />
          </div>
        </motion.section>
      </div>
    </main>
  );
}

/*
|--------------------------------------------------------------------------
| REUSABLE SUMMARY CARD
|--------------------------------------------------------------------------
*/

interface SummaryCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  iconClass: string;
  change: string;
  changeType: "positive" | "negative";
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
  change,
  changeType,
}: SummaryCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-2xl border border-border/70 bg-card p-5 transition hover:border-primary/30 hover:shadow-xl"
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={20} />
        </div>

        {changeType === "positive" ? (
          <ArrowUpRight
            size={17}
            className="text-success"
          />
        ) : (
          <ArrowDownRight
            size={17}
            className="text-danger"
          />
        )}
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        {title}
      </p>

      <p className="mt-1 text-3xl font-bold tracking-tight">
        {value}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {description}
        </p>

        <span className="text-xs font-medium text-success">
          {change}
        </span>
      </div>
    </motion.div>
  );
}

/*
|--------------------------------------------------------------------------
| ANALYSIS INFO
|--------------------------------------------------------------------------
*/

function AnalysisInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold">
        {value}
      </p>
    </div>
  );
}
