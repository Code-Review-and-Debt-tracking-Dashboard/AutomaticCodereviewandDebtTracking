
import {
  Activity,
  BarChart3,
  CalendarDays,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  FindingsIcon,
} from "../../components/icons";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_TICK, CHART_TOOLTIP } from "../../lib/chartStyle";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { apiErrorMessage } from "../../lib/apiError";
import { healthBand, METRIC_HELP } from "../../lib/healthBand";


import {
  BackLink,
  Card,
  StatCard,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  Select,
} from "../../components/ui";

interface TrendPoint {
  date: string;
  healthScore: number;
  debtMinutes: number;
  totalIssues: number;
  vulnerabilityCount: number;
  complexityCount: number;
  duplicationPct: number;
  snapshotId: string;
}

function formatMinutes(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function RepositoryTrendsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const [days, setDays] = useState<number>(30);
  const [raw, setRaw] = useState<TrendPoint[]>([]);
  const [points, setPoints] = useState<{ date: string; score: number }[]>([]);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;

    const fetchTrend = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<{ dataPoints: TrendPoint[] }>(
          `/api/repos/${repoId}/trend?days=${days}`
        );

        const dataPoints = res?.dataPoints ?? [];
        setRaw(dataPoints);

        const mapped = dataPoints.map((dp) => ({
          date: new Date(dp.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          score: dp.healthScore,
        }));
        setPoints(mapped);
        setLatestScore(mapped.length > 0 ? mapped[mapped.length - 1].score : null);
      } catch (err) {
        setError(apiErrorMessage(err, "Failed to load trends."));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrend();
  }, [repoId, days]);

  const healthTrend = points;

  const label = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const metricTrend = raw.map((dp) => ({
    date: label(dp.date),
    findings: dp.totalIssues ?? 0,
    complexity: dp.complexityCount ?? 0,
    duplication: Number((dp.duplicationPct ?? 0).toFixed(1)),
    security: dp.vulnerabilityCount ?? 0,
  }));

  const debtTrend = raw.map((dp) => ({
    date: label(dp.date),
    hours: Number(((dp.debtMinutes ?? 0) / 60).toFixed(2)),
  }));

  const latest = raw.length > 0 ? raw[raw.length - 1] : null;
  // change across the selected range
  const change = latest && raw.length >= 2 ? Math.round((latest.healthScore - raw[0].healthScore) * 10) / 10 : null;

  const summaryCards = [
    {
      help: METRIC_HELP.healthScore,
      title: "Current Health",
      value: latest ? String(latest.healthScore) : "—",
      description: `Across ${raw.length} ${raw.length === 1 ? "analysis" : "analyses"}`,
      icon: Activity,
      color: healthBand(latest?.healthScore).tone,
    },
    {
      help: METRIC_HELP.openFindings,
      title: "Open Findings",
      value: latest ? String(latest.totalIssues ?? 0) : "—",
      description: "In the latest analysis",
      icon: FindingsIcon,
      color: "warning" as const,
    },
    {
      help: METRIC_HELP.technicalDebt,
      title: "Technical Debt",
      value: latest ? formatMinutes(latest.debtMinutes ?? 0) : "—",
      description: "Estimated remediation",
      icon: TrendingDown,
      color: "info" as const,
    },
    {
      help: "How many times this repository has been analyzed in the selected period.",
      title: "Analyses",
      value: String(raw.length),
      description: `In the last ${days} days`,
      icon: BarChart3,
      color: "primary" as const,
    },
  ];

  return (
    <>
      <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

      <PageHeader>
        <div>
          <PageHeaderBadge>
            <TrendingUp size={13} />
            Repository analytics
          </PageHeaderBadge>
          
          <PageHeaderTitle>Repository Trends</PageHeaderTitle>
          
          <PageHeaderDescription>
            Health and technical debt trends over time for {repoId}.
          </PageHeaderDescription>
        </div>
        
        <div className="flex items-center gap-2">
          <CalendarDays size={17} className="text-muted-foreground" />
          <div className="w-40">
            <Select
              value={String(days)}
              onChange={(v) => setDays(Number(v))}
              options={[
                { label: "Last 7 days", value: "7" },
                { label: "Last 30 days", value: "30" },
                { label: "Last 90 days", value: "90" },
                { label: "Last 1 year", value: "365" },
              ]}
            />
          </div>
        </div>
      </PageHeader>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading trends…</p>}
      {error && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              help={card.help}
              icon={Icon}
              color={card.color}
            />
          );
        })}
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
                <Activity size={17} />
              </div>
              <p className="text-sm font-semibold">Health Score Trend</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Overall repository quality score across recent analyses
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className={`text-3xl font-bold ${healthBand(latestScore).textClass}`}>{latestScore}</p>
            {change !== null && (
              <p className="text-xs text-muted-foreground">
                {change >= 0 ? "+" : "−"}
                {Math.abs(change)} points
              </p>
            )}
          </div>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={healthTrend}>
              <defs>
                <linearGradient id="repositoryHealthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={CHART_TICK} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={CHART_TICK} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Area type="monotone" dataKey="score" stroke="hsl(var(--success))" strokeWidth={1.75} fill="url(#repositoryHealthGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {raw.length > 0 && (
        <Card className="mt-6 p-5 sm:p-6">
          <p className="text-sm font-semibold">Recent analyses</p>
          <ul className="mt-3 divide-y divide-border/60 text-sm">
            {[...raw].reverse().slice(0, 5).map((dp) => (
              <li key={dp.date} className="flex items-center justify-between gap-4 py-2">
                <span className="text-muted-foreground">{new Date(dp.date).toLocaleString()}</span>
                <span className="flex items-center gap-4">
                  <span className={`font-mono ${healthBand(dp.healthScore).textClass}`}>{dp.healthScore}</span>
                  <Link
                    to={`/repositories/${repoId}/findings?snapshot=${dp.snapshotId}`}
                    className="text-primary hover:underline"
                  >
                    View findings
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-sm font-semibold">Quality Metrics</p>
            <p className="mt-1 text-xs text-muted-foreground">Findings detected by category over time</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricTrend}>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={CHART_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Line type="monotone" dataKey="findings" name="Total Findings" stroke="hsl(var(--primary))" strokeWidth={1.75} dot={false} />
                <Line type="monotone" dataKey="complexity" name="Complexity" stroke="hsl(var(--warning))" strokeWidth={1.75} dot={false} />
                <Line type="monotone" dataKey="duplication" name="Duplication %" stroke="hsl(var(--info))" strokeWidth={1.75} dot={false} />
                <Line type="monotone" dataKey="security" name="Security" stroke="hsl(var(--danger))" strokeWidth={1.75} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Total Findings", latest ? String(latest.totalIssues ?? 0) : "—", "text-primary"],
              ["Complexity", latest ? String(latest.complexityCount ?? 0) : "—", "text-warning"],
              ["Duplication", latest ? `${(latest.duplicationPct ?? 0).toFixed(1)}%` : "—", "text-info"],
              ["Security", latest ? String(latest.vulnerabilityCount ?? 0) : "—", "text-danger"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-sm font-semibold">Technical Debt Trend</p>
            <p className="mt-1 text-xs text-muted-foreground">Estimated unresolved technical debt over time</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={debtTrend}>
                <defs>
                  <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={CHART_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} />
                <Tooltip formatter={(value) => [`${value} hours`, "Debt"]} contentStyle={CHART_TOOLTIP} />
                <Area type="monotone" dataKey="hours" stroke="hsl(var(--warning))" strokeWidth={1.75} fill="url(#debtGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 rounded-xl border border-success/20 bg-success/5 p-4 flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
              <TrendingDown size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold">Technical debt is decreasing</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {latest ? `Latest analysis: ${formatMinutes(latest.debtMinutes)} of estimated debt.` : "No analysis in this period."}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {raw.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          No analyses in the last {days} days.
        </div>
      )}
    </>
  );
}
