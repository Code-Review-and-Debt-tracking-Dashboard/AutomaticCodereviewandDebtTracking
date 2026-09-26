
import {
  ArrowRight,
  Calendar,
  Code2,
  ExternalLink,
  GitBranch,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AlertIcon,
  CheckIcon,
  DebtIcon,
  FindingsIcon,
  HealthIcon,
  PullRequestIcon,
  TrendIcon,
} from "../../components/icons";

import { CHART_TICK, CHART_TOOLTIP } from "../../lib/chartStyle";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { HotspotTable, type HotspotFile } from "../../components/hotspots/HotspotTable";
import { api } from "../../lib/apiClient";
import { apiErrorMessage } from "../../lib/apiError";
import { healthBand, METRIC_HELP } from "../../lib/healthBand";
import { describeChange, type TrendCounts } from "../../lib/scoreChange";
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

interface LatestRun {
  status: string;
  branch: string;
  errorMessage: string | null;
}

// how often to re-check while an analysis is queued or running
const POLL_MS = 5000;

const ACTIVITY_ICON: Record<string, { icon: typeof CheckIcon; iconClass: string }> = {
  ANALYSIS_COMPLETE: { icon: CheckIcon, iconClass: "bg-success/10 text-success" },
  PR_ANALYZED: { icon: PullRequestIcon, iconClass: "bg-info/10 text-info" },
  QUALITY_GATE_FAILED: { icon: FindingsIcon, iconClass: "bg-danger/10 text-danger" },
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
  const [changes, setChanges] = useState<string[]>([]);
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
  const [latestRun, setLatestRun] = useState<LatestRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  // quiet skips the full-page spinner, for background re-checks
  const loadData = useCallback(async (quiet = false) => {
    if (!repoId) return;

    if (!quiet) setIsLoading(true);
    try {
      const [repoRes, trendRes, debtRes, hotspotsRes, notifRes, runsRes] = await Promise.allSettled([
        api.get<RepoDetail>(`/api/repos/${repoId}`),
        api.get<{ dataPoints: (TrendCounts & { date: string })[] }>(`/api/repos/${repoId}/trend?days=30`),
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
        api.get<{ data: LatestRun[] }>(`/api/repos/${repoId}/analyses`),
      ]);

      if (repoRes.status === "fulfilled") {
        setRepoDetail(repoRes.value);
      }
      if (trendRes.status === "fulfilled" && trendRes.value?.dataPoints) {
        const points = trendRes.value.dataPoints;
        setTrendPoints(
          points.map((dp) => ({
            date: new Date(dp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            score: dp.healthScore,
          }))
        );
        setChanges(points.length >= 2 ? describeChange(points[points.length - 2], points[points.length - 1]) : []);
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
      if (runsRes.status === "fulfilled") {
        setLatestRun(runsRes.value.data[0] ?? null);
      }
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to load repository data."));
    } finally {
      setIsLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // reload quietly until the queued or running analysis is done
  const runInProgress = latestRun?.status === "PENDING" || latestRun?.status === "RUNNING";
  useEffect(() => {
    if (!runInProgress) return;
    const timer = setTimeout(() => loadData(true), POLL_MS);
    return () => clearTimeout(timer);
  }, [latestRun, runInProgress, loadData]);

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
      icon: AlertIcon,
      iconClass: "bg-warning/10 text-warning",
    },
    {
      title: "Complexity",
      value: String(debtBreakdown?.complexity.count ?? 0),
      description: "High complexity areas",
      help: METRIC_HELP.complexity,
      icon: TrendIcon,
      iconClass: "bg-info/10 text-info",
    },
    {
      title: "Security",
      value: String(debtBreakdown?.vulnerability.count ?? 0),
      description: "Security findings",
      help: METRIC_HELP.vulnerabilities,
      icon: FindingsIcon,
      iconClass: "bg-danger/10 text-danger",
    },
    {
      title: "Technical Debt",
      value: repository.technicalDebt,
      description: "Estimated remediation",
      help: METRIC_HELP.technicalDebt,
      icon: DebtIcon,
      iconClass: "bg-primary/10 text-primary",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 size={30} className="animate-spin text-primary" />
        <p className="text-sm">Loading repository overview…</p>
      </div>
    );
  }

  return (
    <>
      
      <PageHeader>
        <div>
          <PageHeaderBadge>
            / repositories / {repository.name}
          </PageHeaderBadge>

          <div className="flex flex-wrap items-center gap-3">
            <PageHeaderTitle>{repository.name}</PageHeaderTitle>
            <span
              className={`rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${healthLabel.cls}`}
            >
              {healthLabel.text}
            </span>
          </div>

          <PageHeaderDescription>
            {repository.fullName}
          </PageHeaderDescription>

          <div className="mt-3.5 flex flex-wrap items-center gap-4 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Code2 size={13} />
              {repository.language}
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch size={13} />
              {repository.defaultBranch}
            </span>
          </div>
        </div>

        <PageHeaderActions>
          <Button data-tour="run-analysis" variant="outline" onClick={() => navigate(`/repositories/${repository.id}/analyze`)}>
            <HealthIcon size={16} />
            Run analysis
          </Button>
          <Button
            variant="primary"
            onClick={() => window.open(repository.githubUrl, "_blank", "noreferrer")}
          >
            <ExternalLink size={15} />
            GitHub
          </Button>
        </PageHeaderActions>
      </PageHeader>

      {runInProgress && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-4 text-sm text-info">
          <Loader2 size={16} className="animate-spin" />
          Analysis running on {latestRun?.branch}. Results will show here when it finishes.
        </div>
      )}
      {latestRun?.status === "FAILED" && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          The last analysis failed{latestRun.errorMessage ? `: ${latestRun.errorMessage}` : "."}{" "}
          <Link to={`/repositories/${repoId}/analyze`} className="font-medium underline">
            See details
          </Link>
        </div>
      )}

      <div data-tour="repo-stats" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Health Score"
          value={repository.healthScore === null ? "—" : String(repository.healthScore)}
          help={METRIC_HELP.healthScore}
          icon={HealthIcon}
          color={band.tone}
        />

        <StatCard
          title="Open Findings"
          value={`${repository.totalFindings}`}
          icon={FindingsIcon}
          color="warning"
        />

        <StatCard
          title="Technical Debt"
          value={repository.technicalDebt}
          help={METRIC_HELP.technicalDebt}
          icon={DebtIcon}
          color="primary"
        />

      </div>

      {repository.healthScore !== null && (
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>
            <span className={`font-medium ${band.textClass}`}>{band.label}.</span> {band.meaning}
          </p>
          {changes.length > 0 && (
            <p>
              Since the last analysis: {changes.join(" · ")}.{" "}
              <Link to={`/repositories/${repoId}/findings`} className="font-medium text-primary hover:underline">
                See findings
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card data-tour="health-trend" className="p-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h3 className="font-display text-[15px] font-semibold tracking-tight">
                Health score trend
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Repository health over the last 30 days
              </p>
            </div>

            <p className="font-mono text-2xl font-semibold text-primary">
              {repository.healthScore === null ? "—" : repository.healthScore}
            </p>
          </div>

          <div className="h-[280px]">
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
                  stroke="hsl(var(--border))"
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={CHART_TICK}
                />

                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={CHART_TICK}
                />

                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                />

                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.75}
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
                  icon: CheckIcon,
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
                    contentStyle={CHART_TOOLTIP}
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
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">
              Hotspots
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Files with the most findings in the latest analysis
            </p>
          </div>
          <button
            type="button"
            data-tour="all-findings"
            onClick={() => navigate(`/repositories/${repoId}/findings`)}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            All findings <ArrowRight size={12} />
          </button>
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
    </>
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
