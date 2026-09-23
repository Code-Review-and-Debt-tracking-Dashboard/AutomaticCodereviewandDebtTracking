
import {
  AlertTriangle,
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
import { healthBand, METRIC_HELP } from "../../lib/healthBand";
import { Loader2 } from "lucide-react";

import {
  Card,
  Button,
  StatCard,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  InfoHint,
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
  lastAnalyzedAt?: string | null;
}

function formatMinutes(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: string;
  repository: { id: string } | null;
}

const ACTIVITY_ICON: Record<string, { icon: typeof CheckCircle2; iconClass: string }> = {
  ANALYSIS_COMPLETE: { icon: CheckCircle2, iconClass: "bg-success/10 text-success" },
  PR_ANALYZED: { icon: GitPullRequest, iconClass: "bg-info/10 text-info" },
  QUALITY_GATE_FAILED: { icon: ShieldAlert, iconClass: "bg-danger/10 text-danger" },
};

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

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
  const [activity, setActivity] = useState<ApiNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [repoRes, trendRes, debtRes, hotspotsRes, notifRes] = await Promise.allSettled([
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
          api.get<{ data: ApiNotification[] }>(`/api/notifications`),
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
        // notifications aren't repo-scoped on the server, so filter here
        if (notifRes.status === "fulfilled") {
          setActivity(
            (notifRes.value.data || []).filter((n) => n.repository?.id === repoId).slice(0, 3)
          );
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
    name: repoDetail?.name || "",
    fullName: repoDetail?.fullName || "",
    owner: repoDetail?.fullName ? repoDetail.fullName.split("/")[0] : "",
    language: repoDetail?.language || "Unknown",
    defaultBranch: repoDetail?.defaultBranch || "main",
    githubUrl: repoDetail?.htmlUrl || "https://github.com",
    isPrivate: repoDetail?.private ?? false,
    healthScore: repoDetail?.healthScore ?? null,
    totalFindings: repoDetail?.openFindings ?? 0,
    // 0 minutes is a real answer, so don't treat it as missing
    technicalDebt: debtData ? formatMinutes(debtData.totalDebtMinutes) : "—",
    debtDelta: debtData?.debtDelta ?? 0,
    lastAnalyzedAt: repoDetail?.lastAnalyzedAt ?? null,
  };

  const band = healthBand(repository.healthScore);
  const healthLabel = {
    text: band.label,
    cls:
      band.tone === "success"
        ? "bg-success/10 text-success"
        : band.tone === "info"
          ? "bg-info/10 text-info"
          : band.tone === "warning"
            ? "bg-warning/10 text-warning"
            : band.tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
  };

  const chartTrend = trendPoints;

  const debtBreakdown = debtData?.breakdown;
  const debtChartData = [
    { key: "vulnerability", label: "Vulnerability", value: debtBreakdown?.vulnerability.debtMinutes ?? 0, color: "hsl(var(--destructive))" },
    { key: "complexity", label: "Complexity", value: debtBreakdown?.complexity.debtMinutes ?? 0, color: "hsl(var(--info))" },
    { key: "duplication", label: "Duplication", value: debtBreakdown?.duplication.debtMinutes ?? 0, color: "hsl(var(--warning))" },
    { key: "code_smell", label: "Code Smell", value: debtBreakdown?.code_smell.debtMinutes ?? 0, color: "#a78bfa" },
    { key: "maintainability", label: "Maintainability", value: debtBreakdown?.maintainability.debtMinutes ?? 0, color: "hsl(var(--success))" },
  ];
  const hasDebtBreakdown = debtChartData.some((d) => d.value > 0);

  const metrics = [
    {
      title: "Code Smells",
      value: String(debtBreakdown?.code_smell.count ?? 0),
      description: "Detected issues",
      help: METRIC_HELP.codeSmells,
      icon: AlertTriangle,
      iconClass: "bg-warning/10 text-warning",
    },
    {
      title: "Complexity",
      value: String(debtBreakdown?.complexity.count ?? 0),
      description: "High complexity areas",
      help: METRIC_HELP.complexity,
      icon: TrendingUp,
      iconClass: "bg-info/10 text-info",
    },
    {
      title: "Security",
      value: String(debtBreakdown?.vulnerability.count ?? 0),
      description: "Security findings",
      help: METRIC_HELP.vulnerabilities,
      icon: ShieldAlert,
      iconClass: "bg-danger/10 text-danger",
    },
    {
      title: "Technical Debt",
      value: repository.technicalDebt,
      description: "Estimated remediation",
      help: METRIC_HELP.technicalDebt,
      icon: Wrench,
      iconClass: "bg-primary/10 text-primary",
    },
  ];

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
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${healthLabel.cls}`}>
                {healthLabel.text}
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
            value={repository.healthScore === null ? "—" : String(repository.healthScore)}
            help={METRIC_HELP.healthScore}
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
            help={METRIC_HELP.technicalDebt}
            icon={Wrench}
            color="primary"
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
                  {repository.healthScore === null ? "—" : repository.healthScore}
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
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity for this repository yet.</p>
              ) : (
                activity.map((item) => {
                  const style = ACTIVITY_ICON[item.type] ?? {
                    icon: CheckCircle2,
                    iconClass: "bg-muted text-muted-foreground",
                  };
                  const Icon = style.icon;
                  return (
                    <div key={item.id} className="flex gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.iconClass}`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.body}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {relativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
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
                  </div>
                  <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
                    {metric.title}
                    <InfoHint text={metric.help} />
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
                      formatter={(value: any, name: any) => [
                        `${Math.floor(Number(value || 0) / 60)}h ${Math.round(Number(value || 0) % 60)}m`,
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
                {repository.lastAnalyzedAt
                  ? `Last analysis ${relativeTime(repository.lastAnalyzedAt)}`
                  : "Not analyzed yet"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar size={14} />
              {repository.lastAnalyzedAt
                ? new Date(repository.lastAnalyzedAt).toLocaleDateString()
                : "—"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <AnalysisInfo label="Open findings" value={String(repository.totalFindings)} />
            <AnalysisInfo label="Technical debt" value={repository.technicalDebt} />
            <AnalysisInfo label="Default branch" value={repository.defaultBranch} />
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
