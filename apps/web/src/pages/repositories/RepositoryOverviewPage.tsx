
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
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HotspotTable, type HotspotFile } from "../../components/hotspots/HotspotTable";
import { api } from "../../lib/apiClient";
import { Loader2 } from "lucide-react";

import {
  Button,
  Card,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  StatCard,
} from "../../components/ui";

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

const healthTrend = [
  { date: "Jun 01", score: 68 },
  { date: "Jun 05", score: 71 },
  { date: "Jun 10", score: 70 },
  { date: "Jun 15", score: 76 },
  { date: "Jun 20", score: 79 },
  { date: "Jun 25", score: 82 },
  { date: "Jun 30", score: 86 },
];

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
  const navigate = useNavigate();
  const [repoDetail, setRepoDetail] = useState<RepoDetail | null>(null);
  const [trendPoints, setTrendPoints] = useState<{ date: string; score: number }[]>([]);
  const [debtData, setDebtData] = useState<{
    totalDebtMinutes: number;
    debtDelta: number;
    breakdown: Record<
      "vulnerability" | "complexity" | "duplication" | "code_smell" | "maintainability",
      { count: number; debtMinutes: number }
    >;
  } | null>(null);
  const [hotspots, setHotspots] = useState<HotspotFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [repoRes, trendRes, debtRes, hotspotsRes] = await Promise.allSettled([
          api.get<RepoDetail>(`/api/repos/${repoId}`),
          api.get<{ dataPoints: { date: string; healthScore: number }[] }>(`/api/repos/${repoId}/trend?days=30`),
          api.get<{
            totalDebtMinutes: number;
            debtDelta: number;
            breakdown: Record<
              "vulnerability" | "complexity" | "duplication" | "code_smell" | "maintainability",
              { count: number; debtMinutes: number }
            >;
          }>(`/api/repos/${repoId}/debt`),
          api.get<{ snapshotId: string; files: HotspotFile[] }>(`/api/repos/${repoId}/hotspots`),
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
        if (hotspotsRes.status === "fulfilled") {
          setHotspots(hotspotsRes.value.files);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load repository data.");
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

  const debtBreakdown = debtData?.breakdown;
  const debtChartData = [
    { key: "vulnerability", label: "Vulnerability", value: debtBreakdown?.vulnerability.debtMinutes ?? 0, color: "hsl(var(--destructive))" },
    { key: "complexity", label: "Complexity", value: debtBreakdown?.complexity.debtMinutes ?? 0, color: "hsl(var(--info))" },
    { key: "duplication", label: "Duplication", value: debtBreakdown?.duplication.debtMinutes ?? 0, color: "hsl(var(--warning))" },
    { key: "code_smell", label: "Code Smell", value: debtBreakdown?.code_smell.debtMinutes ?? 0, color: "#a78bfa" },
    { key: "maintainability", label: "Maintainability", value: debtBreakdown?.maintainability.debtMinutes ?? 0, color: "hsl(var(--success))" },
  ];
  const hasDebtBreakdown = debtChartData.some((d) => d.value > 0);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm">Loading repository overview…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        
        <PageHeader>
          <div>
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Repositories</span>
              <span>/</span>
              <span className="text-foreground">{repository.name}</span>
            </div>

            <PageHeaderBadge className="border-primary/20 bg-primary/10 text-primary">
              <Sparkles size={13} />
              Repository intelligence
            </PageHeaderBadge>

            <div className="flex flex-wrap items-center gap-3">
              <PageHeaderTitle>{repository.name}</PageHeaderTitle>
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                Healthy
              </span>
            </div>

            <PageHeaderDescription>
              {repository.fullName}
            </PageHeaderDescription>

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

          <PageHeaderActions>
            <Button variant="outline">
              <TrendingUp size={17} className="mr-2" />
              Run analysis
            </Button>
            <Button
              variant="primary"
              onClick={() => window.open(repository.githubUrl, "_blank", "noreferrer")}
            >
              <ExternalLink size={17} className="mr-2" />
              GitHub
            </Button>
          </PageHeaderActions>
        </PageHeader>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Health Score"
            value={`${repository.healthScore}`}
            icon={CheckCircle2}
            color="success"
          />

          <StatCard
            title="Open Findings"
            value={`${repository.totalFindings}`}
            icon={ShieldAlert}
            color="warning"
          />

          <StatCard
            title="Technical Debt"
            value={repository.technicalDebt}
            icon={Wrench}
            color="primary"
          />

          <StatCard
            title="Pull Requests"
            value="42"
            icon={GitPullRequest}
            color="info"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card className="p-5 sm:p-6">
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
          </Card>

          <Card className="p-5 sm:p-6">
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
          </Card>
        </div>

        <Card className="mt-6 p-5 sm:p-6">
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
        </Card>

        <Card className="mt-6 p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-sm font-semibold">
              Debt Breakdown
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Estimated remediation effort by category
            </p>
          </div>

          {hasDebtBreakdown ? (
            <div className="grid gap-6 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-center">
              <div className="relative h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={debtChartData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {debtChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>

                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`,
                        name,
                      ]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xl font-bold">
                    {repository.technicalDebt}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Total debt
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {debtChartData.map((entry) => (
                  <div
                    key={entry.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />

                      <span className="text-sm font-medium">
                        {entry.label}
                      </span>
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {Math.floor(entry.value / 60)}h {Math.round(entry.value % 60)}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No debt data available yet. Run an analysis to see the breakdown.
            </p>
          )}
        </Card>

        <Card className="mt-6 p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-sm font-semibold">
              Hotspots
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Files with the most findings in the latest analysis
            </p>
          </div>

          <HotspotTable
            files={hotspots}
            onRowClick={(file) =>
              navigate(`/repositories/${repoId}/findings?file=${encodeURIComponent(file)}`)
            }
          />
        </Card>

        <Card className="mt-6 p-5 sm:p-6">
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
            <AnalysisInfo label="Files analyzed" value="248" />
            <AnalysisInfo label="Lines of code" value="42,891" />
            <AnalysisInfo label="Analysis duration" value="2m 34s" />
          </div>
        </Card>
      </div>
    </main>
  );
}

function AnalysisInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
