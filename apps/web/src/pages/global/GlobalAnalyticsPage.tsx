import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useOrg } from "../../contexts/OrgContext";
import { api } from "../../lib/apiClient";
import { healthBand } from "../../lib/healthBand";
import {
  ArrowUpDown,
  ChevronRight,
  Code2,
} from "lucide-react";

import {
  CheckIcon,
  DebtIcon,
  RepositoriesIcon,
  TrendIcon,
} from "../../components/icons";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_TICK, CHART_TOOLTIP } from "../../lib/chartStyle";

import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  StatCard,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  FilterBar,
  Select,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
} from "../../components/ui";


/* =========================================================
   TREND DATA — Health Score vs Tech Debt
========================================================= */

interface ApiRepository {
  id: string;
  name: string;
  fullName: string;
  language: string | null;
  healthScore: number | null;
  openFindings: number | null;
  debtMinutes: number | null;
}

interface TrendPoint {
  date: string;
  healthScore: number;
  debtMinutes: number;
}

interface AnalyticsRepo {
  id: string;
  name: string;
  owner: string;
  language: string;
  langColor: string;
  healthScore: number | null;
  techDebt: string;
  trend: number[];
  status: string;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-info/10 text-info",
  JavaScript: "bg-warning/10 text-warning",
  Python: "bg-success/10 text-success",
  Java: "bg-danger/10 text-danger",
};

function debtLabel(minutes: number | null): string {
  if (minutes === null) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function GlobalAnalyticsPage() {
  const navigate = useNavigate();
  const { selectedOrg } = useOrg();

  const [searchQuery, setSearchQuery] = useState("");
  const [langFilter, setLangFilter] = useState("All");
  const [timeFilter, setTimeFilter] = useState("All");

  const [repositoryTable, setRepositoryTable] = useState<AnalyticsRepo[]>([]);
  const [trendData, setTrendData] = useState<{ month: string; health: number; debt: number }[]>([]);
  const [languageData, setLanguageData] = useState<{ name: string; score: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrg) {
      setRepositoryTable([]);
      setTrendData([]);
      setLanguageData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ApiRepository[] }>(
        `/api/orgs/${selectedOrg.id}/repos`
      );
      const repos = res.data || [];

      // one trend call per repo — there is no org-wide trend endpoint
      const trends = await Promise.all(
        repos.map((r) =>
          api
            .get<{ dataPoints: TrendPoint[] }>(`/api/repos/${r.id}/trend`, { days: 30 })
            .then((t) => t.dataPoints || [])
            .catch(() => [] as TrendPoint[])
        )
      );

      setRepositoryTable(
        repos.map((r, i) => ({
          id: r.id,
          name: r.name,
          owner: r.fullName.split("/")[0],
          language: r.language || "Unknown",
          langColor: LANG_COLORS[r.language || ""] || "bg-muted text-muted-foreground",
          healthScore: r.healthScore,
          techDebt: debtLabel(r.debtMinutes),
          trend: trends[i].map((dp) => dp.healthScore),
          status: healthBand(r.healthScore).label,
        }))
      );

      // average health and debt per day across the org
      const byDay = new Map<string, { health: number[]; debt: number[] }>();
      for (const series of trends) {
        for (const dp of series) {
          const day = dp.date.slice(0, 10);
          const entry = byDay.get(day) ?? { health: [], debt: [] };
          entry.health.push(dp.healthScore);
          entry.debt.push(dp.debtMinutes / 60);
          byDay.set(day, entry);
        }
      }
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      setTrendData(
        [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, v]) => ({
            month: new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            health: Number(avg(v.health).toFixed(1)),
            debt: Number(avg(v.debt).toFixed(1)),
          }))
      );

      // average health per language, analysed repos only
      const byLang = new Map<string, number[]>();
      for (const r of repos) {
        if (r.healthScore === null) continue;
        const key = r.language || "Unknown";
        byLang.set(key, [...(byLang.get(key) ?? []), r.healthScore]);
      }
      setLanguageData(
        [...byLang.entries()].map(([name, scores]) => ({
          name,
          score: Number(avg(scores).toFixed(1)),
        }))
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load analytics for this organization.");
      setRepositoryTable([]);
      setTrendData([]);
      setLanguageData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const orgStats = useMemo(() => {
    const analyzed = repositoryTable.filter((r) => r.healthScore !== null);
    const avg =
      analyzed.length > 0
        ? (analyzed.reduce((a, r) => a + (r.healthScore ?? 0), 0) / analyzed.length).toFixed(1)
        : "—";
    const debtMins = repositoryTable.reduce((a, r) => {
      const m = /^(?:(\d+)h )?(\d+)m$/.exec(r.techDebt);
      return a + (m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : 0);
    }, 0);
    return {
      avgHealth: avg,
      totalDebt: debtLabel(debtMins),
      analyzed: `${analyzed.length}/${repositoryTable.length}`,
    };
  }, [repositoryTable]);

  const filteredRepos = useMemo(() => {
    return repositoryTable.filter((r) => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.owner.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLang = langFilter === "All" || r.language === langFilter;
      return matchesSearch && matchesLang;
    });
  }, [repositoryTable, searchQuery, langFilter]);

  return (
    <>

      {/* Header */}
      <PageHeader>
        <div>
          <PageHeaderTitle>Organization Analytics</PageHeaderTitle>
          <PageHeaderDescription>
            Long-term code quality, debt remediation trajectory, and security compliance trends across all repositories.
          </PageHeaderDescription>
        </div>

        <PageHeaderActions>
          <Button onClick={() => navigate("/repositories")}>
            <Code2 size={17} />
            View Repositories
          </Button>
        </PageHeaderActions>
      </PageHeader>


      {/* Stat Cards */}
      <div data-tour="analytics-stats" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Average Health Score"
          value={orgStats.avgHealth}
          icon={TrendIcon}
          iconColor="bg-success/10 text-success"
          delay={0}
        />
        <StatCard
          title="Technical Debt"
          value={orgStats.totalDebt}
          icon={DebtIcon}
          iconColor="bg-info/10 text-info"
          delay={0.08}
        />
        <StatCard
          title="Repositories Tracked"
          value={String(repositoryTable.length)}
          icon={RepositoriesIcon}
          iconColor="bg-primary/10 text-primary"
          delay={0.16}
        />
        <StatCard
          title="Analyzed"
          value={orgStats.analyzed}
          icon={CheckIcon}
          iconColor="bg-success/10 text-success"
          delay={0.24}
        />
      </div>


      {/* Charts Row */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">

        {/* Health Score vs Tech Debt */}
        <Card data-tour="health-debt-chart">
          <CardHeader>
            <div>
              <CardTitle>Health Score vs. Tech Debt (Hours)</CardTitle>
              <CardDescription>Monthly historical progression</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                Average Health Score
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                Technical Debt (Hours)
              </span>
            </div>
          </CardHeader>

          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
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
                  <Line
                    type="monotone"
                    dataKey="health"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.75}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="debt"
                    stroke="hsl(var(--success))"
                    strokeWidth={1.75}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Language Breakdown */}
        <Card data-tour="language-chart">
          <CardHeader>
            <div>
              <CardTitle>Language Breakdown & Health</CardTitle>
              <CardDescription>Average health score by primary language</CardDescription>
            </div>
          </CardHeader> 

          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={languageData}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    horizontal={false}
                  />
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
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                  />
                  <Bar
                    dataKey="score"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                    barSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>


      {/* Repository Overview Table */}
      <Card data-tour="repo-table" className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Repository Overview</CardTitle>
            <CardDescription>Key metrics for your top repositories</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {/* Search + Filters */}
          <FilterBar
            placeholder="Search repositories by name, language, or owner..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            className="mb-4"
          >
            <Select
              value={langFilter}
              onChange={setLangFilter}
              options={[
                { label: "All Languages", value: "All" },
                { label: "TypeScript", value: "TypeScript" },
                { label: "Python", value: "Python" },
                { label: "JavaScript", value: "JavaScript" },
                { label: "Java", value: "Java" },
              ]}
            />
            <Select
              value={timeFilter}
              onChange={setTimeFilter}
              options={[
                { label: "All Time", value: "All" },
                { label: "Last 30 Days", value: "30d" },
                { label: "Last 90 Days", value: "90d" },
              ]}
            />
          </FilterBar>


          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Repository</DataTableHeaderCell>
              <DataTableHeaderCell>Primary Language</DataTableHeaderCell>
              <DataTableHeaderCell align="center">
                Health Score <ArrowUpDown size={10} className="ml-1 inline" />
              </DataTableHeaderCell>
              <DataTableHeaderCell align="center">Tech Debt</DataTableHeaderCell>
              <DataTableHeaderCell align="center">Trend</DataTableHeaderCell>
              <DataTableHeaderCell align="center">Status</DataTableHeaderCell>
              <DataTableHeaderCell align="right" className="w-10" children={""} />
            </DataTableHead>

            <DataTableBody>
              {filteredRepos.map((repo) => (
                <DataTableRow key={repo.name}>
                  {/* Name */}
                  <DataTableCell>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${repo.langColor}`}>
                        {repo.language.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{repo.name}</p>
                        <p className="text-[11px] text-muted-foreground">{repo.owner}</p>
                      </div>
                    </div>
                  </DataTableCell>

                  {/* Language */}
                  <DataTableCell>
                    <Badge variant="default" size="sm">
                      {repo.language}
                    </Badge>
                  </DataTableCell>

                  {/* Health Score */}
                  <DataTableCell align="center">
                    <span className={`text-lg font-bold ${healthBand(repo.healthScore).textClass}`}>
                      {repo.healthScore ?? "—"}
                    </span>
                  </DataTableCell>

                  {/* Tech Debt */}
                  <DataTableCell align="center">
                    <span className="text-sm font-medium">{repo.techDebt}</span>
                  </DataTableCell>

                  {/* Sparkline Trend */}
                  <DataTableCell align="center">
                    <div className="mx-auto h-8 w-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={repo.trend.map((v, i) => ({ v, i }))}>
                          <defs>
                            <linearGradient id={`spark-${repo.name}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="v"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fill={`url(#spark-${repo.name})`}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </DataTableCell>

                  {/* Status */}
                  <DataTableCell align="center">
                    <Badge
                      variant={repo.status === "Good" ? "success" : "warning"}
                      size="md"
                    >
                      {repo.status}
                    </Badge>
                  </DataTableCell>

                  {/* Arrow */}
                  <DataTableCell align="right">
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </DataTableCell>
                </DataTableRow>
              ))}
              {filteredRepos.length === 0 && (
                <DataTableRow>
                  <DataTableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {isLoading
                      ? "Loading analytics…"
                      : error
                        ? error
                        : repositoryTable.length === 0
                          ? "No repositories linked in this organization yet."
                          : "No repositories match your filters."}
                  </DataTableCell>
                </DataTableRow>
              )}
            </DataTableBody>
          </DataTable>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Showing {filteredRepos.length} of 12 repositories
          </p>
        </CardContent>
      </Card>


      {/* Footer */}
      <footer className="mt-10 py-6 text-center text-xs text-muted-foreground">
        © 2025 CodePulse · v1.0
      </footer>

    </>
  );
}
