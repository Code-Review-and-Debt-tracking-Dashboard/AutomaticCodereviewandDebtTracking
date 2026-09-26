import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ArrowRight, ExternalLink, Plus } from "lucide-react";

import {
  CheckIcon,
  DebtIcon,
  FindingsIcon,
  HealthIcon,
  PullRequestIcon,
  RepositoriesIcon,
} from "../../components/icons";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  IconBox,
  StatCard,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  FilterBar,
  Select,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui";

import { useAuth } from "../../contexts/AuthContext";
import { CHART_CURSOR, CHART_TICK, CHART_TOOLTIP } from "../../lib/chartStyle";
import { healthBand, METRIC_HELP } from "../../lib/healthBand";
import { useOrg } from "../../contexts/OrgContext";
import { api } from "../../lib/apiClient";
import { apiErrorMessage } from "../../lib/apiError";


// health/findings/debt are null until the repo has been analysed
interface ApiRepository {
  id: string;
  name: string;
  fullName: string;
  language: string | null;
  healthScore: number | null;
  openFindings: number | null;
  debtMinutes: number | null;
  lastAnalyzedAt: string | null;
}

interface ApiTrendPoint {
  date: string;
  healthScore: number;
}

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: string;
  repository: { id: string; name: string; fullName: string } | null;
}

interface DashboardRepo {
  id: string;
  name: string;
  language: string;
  score: number | null;
  findings: number | null;
  debtMinutes: number | null;
  debt: string;
  status: string;
}

function debtLabel(minutes: number | null): string {
  if (minutes === null) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}



// bucket every repo's snapshots by day, then average each day across repos
function averageByDay(series: ApiTrendPoint[][]): { name: string; score: number }[] {
  const byDay = new Map<string, number[]>();

  for (const points of series) {
    for (const point of points) {
      const day = point.date.slice(0, 10);
      const scores = byDay.get(day) ?? [];
      scores.push(point.healthScore);
      byDay.set(day, scores);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, scores]) => ({
      name: new Date(day).toLocaleDateString(undefined, { weekday: "short" }),
      score: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
    }));
}

const ACTIVITY_ICON: Record<string, { icon: typeof CheckIcon; color: string }> = {
  ANALYSIS_COMPLETE: { icon: CheckIcon, color: "text-success bg-success/10" },
  PR_ANALYZED: { icon: PullRequestIcon, color: "text-info bg-info/10" },
  QUALITY_GATE_FAILED: { icon: FindingsIcon, color: "text-warning bg-warning/10" },
};

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}




export function DashboardPage() {

  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedOrg } = useOrg();

  const [repositories, setRepositories] = useState<DashboardRepo[]>([]);
  const [healthTrend, setHealthTrend] = useState<{ name: string; score: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<ApiNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Search + Filter State */
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("All");
  const [scoreFilter, setScoreFilter] = useState("All");

  const fetchDashboard = useCallback(async () => {
    if (!selectedOrg) {
      setRepositories([]);
      setHealthTrend([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ApiRepository[] }>(
        `/api/orgs/${selectedOrg.id}/repos`
      );
      const apiList = res.data || [];

      setRepositories(
        apiList.map((item) => ({
          id: item.id,
          name: item.name,
          language: item.language || "Unknown",
          score: item.healthScore,
          findings: item.openFindings,
          debtMinutes: item.debtMinutes,
          debt: debtLabel(item.debtMinutes),
          status: healthBand(item.healthScore).label,
        }))
      );

      // one trend call per repo — no org-wide trend endpoint exists
      const trends = await Promise.all(
        apiList.map((item) =>
          api
            .get<{ dataPoints: ApiTrendPoint[] }>(`/api/repos/${item.id}/trend`, { days: 7 })
            .then((t) => t.dataPoints || [])
            .catch(() => [] as ApiTrendPoint[])
        )
      );
      setHealthTrend(averageByDay(trends));

      const notifications = await api
        .get<{ data: ApiNotification[] }>("/api/notifications")
        .then((n) => n.data || [])
        .catch(() => [] as ApiNotification[]);
      setRecentActivity(notifications.slice(0, 3));
    } catch (err: any) {
      setError(
        apiErrorMessage(err, "Failed to load dashboard for this organization.")
      );
      setRepositories([]);
      setHealthTrend([]);
      setRecentActivity([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* Stat cards — averages skip repos that have never been analysed */
  const stats = useMemo(() => {
    const scored = repositories.filter((r) => r.score !== null);
    const avgHealth =
      scored.length > 0
        ? (scored.reduce((acc, r) => acc + (r.score ?? 0), 0) / scored.length).toFixed(1)
        : "—";
    const totalFindings = repositories.reduce((acc, r) => acc + (r.findings ?? 0), 0);
    const totalDebtMinutes = repositories.reduce((acc, r) => acc + (r.debtMinutes ?? 0), 0);

    return [
      {
        title: "Repositories",
        value: String(repositories.length),
        help: "How many repositories are connected to CodePulse in this organization.",
        icon: RepositoriesIcon,
        iconColor: "bg-primary/10 text-primary",
      },
      {
        title: "Average Health",
        value: avgHealth,
        help: METRIC_HELP.healthScore,
        icon: HealthIcon,
        iconColor: "bg-success/10 text-success",
      },
      {
        title: "Open Findings",
        value: String(totalFindings),
        help: METRIC_HELP.openFindings,
        icon: FindingsIcon,
        iconColor: "bg-warning/10 text-warning",
      },
      {
        title: "Technical Debt",
        value: debtLabel(totalDebtMinutes),
        help: METRIC_HELP.technicalDebt,
        icon: DebtIcon,
        iconColor: "bg-info/10 text-info",
      },
    ];
  }, [repositories]);

  const latestTrendScore = healthTrend.length > 0 ? healthTrend[healthTrend.length - 1].score : null;

  /* Filter Repositories */
  const filteredRepositories = useMemo(() => {
    return repositories.filter((repo) => {
      const matchesSearch = repo.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesLanguage =
        languageFilter === "All" || repo.language === languageFilter;

      const matchesScore =
        scoreFilter === "All" ||
        (scoreFilter === "Excellent" && (repo.score ?? 0) >= 85) ||
        (scoreFilter === "Needs attention" && (repo.score ?? 0) < 85);

      return matchesSearch && matchesLanguage && matchesScore;
    });
  }, [repositories, searchQuery, languageFilter, scoreFilter]);

  const languageOptions = useMemo(() => {
    const langs = [...new Set(repositories.map((r) => r.language))].sort();
    return [
      { label: "All Languages", value: "All" },
      ...langs.map((l) => ({ label: l, value: l })),
    ];
  }, [repositories]);


  return (
    <>

      <PageHeader>
        <div>
          <PageHeaderBadge>
            {selectedOrg?.login ? `/ ${selectedOrg.login}` : "/ workspace"}
          </PageHeaderBadge>

          <PageHeaderTitle>Overview</PageHeaderTitle>

          <PageHeaderDescription>
            {user ? `${user.username} — here is` : "Here is"} the latest
            overview of your code quality and technical debt.
          </PageHeaderDescription>
        </div>

        <PageHeaderActions>
          <Button onClick={() => navigate("/repositories")}>
            <Plus size={15} />
            Add repository
          </Button>
        </PageHeaderActions>
      </PageHeader>


      <div data-tour="stats" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            help={stat.help}
            icon={stat.icon}
            iconColor={stat.iconColor}
            delay={index * 0.08}
          />
        ))}
      </div>


      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">

        {/* Health Score Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Health score trend</CardTitle>
                <CardDescription>
                  Average repository health over the last 7 days
                </CardDescription>
              </div>
              {latestTrendScore !== null && (
                <p className="font-mono text-2xl font-semibold text-primary">
                  {latestTrendScore}
                </p>
              )}
            </CardHeader>

            <CardContent>
              <div className="h-[260px] w-full">
                {healthTrend.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-center">
                    <p className="text-[13px] font-medium">No analysis history yet</p>
                    <p className="text-xs text-muted-foreground">
                      The trend appears once a repository has been analyzed.
                    </p>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={healthTrend} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} />

                    <XAxis
                      dataKey="name"
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

                    <Tooltip contentStyle={CHART_TOOLTIP} cursor={CHART_CURSOR} />

                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.75}
                      fill="url(#healthGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>


        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="h-full">
            <CardHeader>
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Latest repository events</CardDescription>
              </div>
              <button
                onClick={() => navigate("/notifications")}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all
                <ArrowRight size={12} />
              </button>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No activity yet.</p>
                ) : (
                  recentActivity.map((activity) => {
                    const style = ACTIVITY_ICON[activity.type] ?? {
                      icon: CheckIcon,
                      color: "text-muted-foreground bg-muted",
                    };

                    return (
                      <div key={activity.id} className="flex gap-3">
                        <IconBox
                          icon={style.icon}
                          size="sm"
                          className={style.color}
                        />

                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">
                            {activity.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {activity.body || activity.repository?.fullName || ""}
                          </p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {relativeTime(activity.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>


      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mt-6"
      >
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Repository health</CardTitle>
              <CardDescription>Monitor your connected repositories</CardDescription>
            </div>
            <button
              onClick={() => navigate("/repositories")}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View repositories
              <ArrowRight size={12} />
            </button>
          </CardHeader>

          <CardContent>
            {/* Search + Filters */}
            <FilterBar
              placeholder="Search repositories..."
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              className="mb-5"
            >
              <Select
                value={languageFilter}
                onChange={setLanguageFilter}
                options={languageOptions}
              />
              <Select
                value={scoreFilter}
                onChange={setScoreFilter}
                options={[
                  { label: "All Scores", value: "All" },
                  { label: "Excellent", value: "Excellent" },
                  { label: "Needs attention", value: "Needs attention" },
                ]}
              />
              <Button size="sm" onClick={() => navigate("/repositories")}>
                <Plus size={15} />
                Link Repository
              </Button>
            </FilterBar>


            {/* Repository Rows */}
            <div className="grid gap-2">
              {isLoading ? (
                <LoadingState message="Loading repositories..." className="border-0" />
              ) : error ? (
                <ErrorState message={error} onRetry={fetchDashboard} />
              ) : filteredRepositories.length > 0 ? (
                filteredRepositories.map((repo) => (
                  <div
                    key={repo.id}
                    className="
                      group flex flex-col gap-3 rounded-md border border-border
                      px-4 py-3 transition-colors
                      hover:border-primary/50 hover:bg-accent/40
                      sm:flex-row sm:items-center
                    "
                  >
                    {/* Repo Info */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <IconBox icon={RepositoriesIcon} color="primary" size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">
                          {repo.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          {repo.language}
                        </p>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-5 sm:gap-7">
                      <Metric label="Health">
                        <span className={`font-mono text-base font-semibold ${healthBand(repo.score).textClass}`}>
                          {repo.score ?? "—"}
                        </span>
                      </Metric>

                      <Metric label="Findings" className="hidden sm:block">
                        <span className="font-mono text-base">{repo.findings ?? "—"}</span>
                      </Metric>

                      <Metric label="Debt" className="hidden md:block">
                        <span className="font-mono text-base">{repo.debt}</span>
                      </Metric>

                      <Badge
                        variant={healthBand(repo.score).tone === "destructive" ? "destructive" : healthBand(repo.score).tone}
                        size="md"
                      >
                        {repo.status}
                      </Badge>

                      <button
                        onClick={() => navigate(`/repositories/${repo.id}`)}
                        className="hidden items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary lg:inline-flex"
                      >
                        View <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={repositories.length === 0 ? "No repositories linked yet" : "No repositories found"}
                  description={
                    repositories.length === 0
                      ? "Link a repository to start tracking its health."
                      : "Try changing your search or filters."
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}

/* Small label + figure pair used in the repository rows. */
function Metric({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="eyebrow text-[10px]">{label}</p>
      <p className="mt-0.5 leading-none">{children}</p>
    </div>
  );
}