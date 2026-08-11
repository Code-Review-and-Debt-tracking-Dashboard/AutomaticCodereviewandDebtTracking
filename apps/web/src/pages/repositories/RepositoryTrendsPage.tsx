import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Code2,
  GitPullRequest,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { Loader2 } from "lucide-react";

import {
  BackLink,
  Card,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  StatCard,
  Select,
} from "../../components/ui";

const metricTrend = [
  { date: "Jun 16", codeSmells: 48, complexity: 32, duplication: 18, security: 9 },
  { date: "Jun 17", codeSmells: 45, complexity: 31, duplication: 17, security: 8 },
  { date: "Jun 18", codeSmells: 43, complexity: 30, duplication: 16, security: 8 },
  { date: "Jun 19", codeSmells: 38, complexity: 28, duplication: 14, security: 6 },
  { date: "Jun 20", codeSmells: 34, complexity: 26, duplication: 13, security: 5 },
  { date: "Jun 21", codeSmells: 31, complexity: 24, duplication: 11, security: 4 },
  { date: "Jun 22", codeSmells: 28, complexity: 22, duplication: 10, security: 3 },
  { date: "Jun 23", codeSmells: 24, complexity: 20, duplication: 8, security: 2 },
];

const debtTrend = [
  { date: "Jun 16", hours: 14.5 },
  { date: "Jun 17", hours: 13.8 },
  { date: "Jun 18", hours: 12.6 },
  { date: "Jun 19", hours: 11.2 },
  { date: "Jun 20", hours: 9.8 },
  { date: "Jun 21", hours: 8.1 },
  { date: "Jun 22", hours: 6.4 },
  { date: "Jun 23", hours: 4.3 },
];

const summaryCards = [
  {
    title: "Current Health",
    value: "88",
    description: "+16 points in 7 days",
    icon: Activity,
    color: "success" as const,
    trend: "up",
  },
  {
    title: "Open Findings",
    value: "34",
    description: "-42% from last week",
    icon: ShieldAlert,
    color: "warning" as const,
    trend: "down",
  },
  {
    title: "Technical Debt",
    value: "4h 20m",
    description: "-10h 10m this week",
    icon: TrendingDown,
    color: "info" as const,
    trend: "down",
  },
  {
    title: "Analyses",
    value: "24",
    description: "+6 this week",
    icon: BarChart3,
    color: "primary" as const,
    trend: "up",
  },
];

const recentChanges = [
  {
    title: "Health score improved",
    description: "Repository health increased from 84 to 88",
    time: "Today, 10:42 AM",
    icon: TrendingUp,
    className: "bg-success/10 text-success",
  },
  {
    title: "Security findings reduced",
    description: "7 security issues were resolved",
    time: "Yesterday, 4:18 PM",
    icon: ShieldAlert,
    className: "bg-info/10 text-info",
  },
  {
    title: "Pull request analyzed",
    description: "PR #42 introduced 3 new findings",
    time: "Yesterday, 11:26 AM",
    icon: GitPullRequest,
    className: "bg-primary/10 text-primary",
  },
];

export function RepositoryTrendsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const [days, setDays] = useState<number>(30);
  const [points, setPoints] = useState<{ date: string; score: number }[]>([]);
  const [latestScore, setLatestScore] = useState<number>(88);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!repoId) return;

    const fetchTrend = async () => {
      setIsLoading(true);
      try {
        const res = await api.get<{ dataPoints: { date: string; healthScore: number }[] }>(
          `/api/repos/${repoId}/trend?days=${days}`
        );

        if (res?.dataPoints && res.dataPoints.length > 0) {
          const mapped = res.dataPoints.map((dp) => ({
            date: new Date(dp.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            score: dp.healthScore,
          }));
          setPoints(mapped);
          setLatestScore(mapped[mapped.length - 1].score);
        }
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrend();
  }, [repoId, days]);

  const healthTrend = points.length > 0 ? points : [
    { date: "Jun 16", score: 72 },
    { date: "Jun 17", score: 74 },
    { date: "Jun 18", score: 73 },
    { date: "Jun 19", score: 78 },
    { date: "Jun 20", score: 81 },
    { date: "Jun 21", score: 84 },
    { date: "Jun 22", score: 86 },
    { date: "Jun 23", score: 88 },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

        <PageHeader>
          <div>
            <PageHeaderBadge className="border-primary/20 bg-primary/10 text-primary">
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

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <StatCard
                key={card.title}
                title={card.title}
                value={card.value}
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
              <p className="text-3xl font-bold text-success">{latestScore}</p>
              <p className="text-xs text-success">+16 points</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                <Area type="monotone" dataKey="score" stroke="hsl(var(--success))" strokeWidth={3} fill="url(#repositoryHealthGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <div className="mb-6">
              <p className="text-sm font-semibold">Quality Metrics</p>
              <p className="mt-1 text-xs text-muted-foreground">Findings detected by category over time</p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                  <Line type="monotone" dataKey="codeSmells" name="Code Smells" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="complexity" name="Complexity" stroke="hsl(var(--warning))" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="duplication" name="Duplication" stroke="hsl(var(--info))" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="security" name="Security" stroke="hsl(var(--danger))" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Code Smells", "24", "text-primary"],
                ["Complexity", "20", "text-warning"],
                ["Duplication", "8", "text-info"],
                ["Security", "2", "text-danger"],
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value} hours`, "Debt"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                  <Area type="monotone" dataKey="hours" stroke="hsl(var(--warning))" strokeWidth={3} fill="url(#debtGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 rounded-xl border border-success/20 bg-success/5 p-4 flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
                <TrendingDown size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold">Technical debt is decreasing</p>
                <p className="mt-1 text-xs text-muted-foreground">The repository reduced estimated debt by 70% during the selected period.</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="mt-6 p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-sm font-semibold">Recent Trend Changes</p>
            <p className="mt-1 text-xs text-muted-foreground">Important changes detected in repository quality</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {recentChanges.map((change) => {
              const Icon = change.icon;
              return (
                <div key={change.title} className="rounded-xl border border-border/60 p-4 transition hover:border-primary/30 hover:bg-muted/20">
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${change.className}`}>
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-semibold">{change.title}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{change.description}</p>
                  <p className="mt-3 text-[11px] text-muted-foreground">{change.time}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-xs text-success">
          <CheckCircle2 size={15} />
          Latest repository analysis completed successfully.
        </div>
      </div>
    </main>
  );
}
