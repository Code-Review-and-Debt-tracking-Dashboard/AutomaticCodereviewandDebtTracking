import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Code2,
  TrendingUp,
  Wrench,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  FilterBar,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  Select,
  StatCard,
} from "../../components/ui";


/* =========================================================
   TREND DATA — Health Score vs Tech Debt
========================================================= */

const trendData = [
  { month: "Dec", health: 72, debt: 56 },
  { month: "Jan", health: 74, debt: 52 },
  { month: "Feb", health: 78, debt: 48 },
  { month: "Mar", health: 80, debt: 42 },
  { month: "Apr", health: 83, debt: 38 },
  { month: "May", health: 86, debt: 34 },
];


/* =========================================================
   LANGUAGE DATA
========================================================= */

const languageData = [
  { name: "TypeScript", score: 92 },
  { name: "Python", score: 95 },
  { name: "JavaScript", score: 85 },
  { name: "Java", score: 76 },
];


/* =========================================================
   REPOSITORY TABLE DATA
========================================================= */

const repositoryTable = [
  {
    name: "AutomaticCodeReview",
    owner: "@codeguard",
    language: "TypeScript",
    langColor: "bg-info/10 text-info",
    healthScore: 91,
    techDebt: "18h",
    trend: [78, 82, 85, 88, 91],
    gatePassRate: "98%",
    status: "Good",
  },
  {
    name: "AnalysisWorker",
    owner: "@codeguard",
    language: "Python",
    langColor: "bg-success/10 text-success",
    healthScore: 88,
    techDebt: "12h",
    trend: [80, 82, 84, 86, 88],
    gatePassRate: "96%",
    status: "Good",
  },
  {
    name: "MobileDashboard",
    owner: "@codeguard",
    language: "JavaScript",
    langColor: "bg-warning/10 text-warning",
    healthScore: 82,
    techDebt: "20h",
    trend: [74, 76, 78, 80, 82],
    gatePassRate: "90%",
    status: "Needs Attention",
  },
  {
    name: "BackendAPI",
    owner: "@codeguard",
    language: "Java",
    langColor: "bg-destructive/10 text-destructive",
    healthScore: 76,
    techDebt: "26h",
    trend: [70, 72, 73, 75, 76],
    gatePassRate: "85%",
    status: "Needs Attention",
  },
];


/* =========================================================
   COMPONENT
========================================================= */

export function GlobalAnalyticsPage() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [langFilter, setLangFilter] = useState("All");
  const [timeFilter, setTimeFilter] = useState("All");

  const filteredRepos = useMemo(() => {
    return repositoryTable.filter((r) => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.owner.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLang = langFilter === "All" || r.language === langFilter;
      return matchesSearch && matchesLang;
    });
  }, [searchQuery, langFilter]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Average Health Score"
            value="86.4"
            change="+18 points in 6 months"
            trend="up"
            icon={TrendingUp}
            iconColor="bg-success/10 text-success"
            delay={0}
          />
          <StatCard
            title="Remediated Debt"
            value="140 hours"
            change="42 remaining"
            trend="down"
            icon={Wrench}
            iconColor="bg-info/10 text-info"
            delay={0.08}
          />
          <StatCard
            title="Repositories Tracked"
            value="12"
            change="100% active coverage"
            trend="up"
            icon={Code2}
            iconColor="bg-primary/10 text-primary"
            delay={0.16}
          />
          <StatCard
            title="Gate Pass Rate"
            value="94.2%"
            change="PR Quality Compliance"
            trend="up"
            icon={CheckCircle2}
            iconColor="bg-success/10 text-success"
            delay={0.24}
          />
        </div>


        {/* Charts Row */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">

          {/* Health Score vs Tech Debt */}
          <Card>
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
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="health"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="debt"
                      stroke="hsl(var(--success))"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Language Breakdown */}
          <Card>
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
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      horizontal={false}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        color: "hsl(var(--foreground))",
                      }}
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
        <Card className="mt-6">
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
                <DataTableHeaderCell align="center">Gate Pass Rate</DataTableHeaderCell>
                <DataTableHeaderCell align="center">Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right" className="w-10" />
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
                      <span className={`text-lg font-bold ${repo.healthScore >= 85 ? "text-success" : "text-warning"}`}>
                        {repo.healthScore}
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

                    {/* Gate Pass Rate */}
                    <DataTableCell align="center">
                      <span className="text-sm font-medium">{repo.gatePassRate}</span>
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
              </DataTableBody>
            </DataTable>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Showing {filteredRepos.length} of 12 repositories
            </p>
          </CardContent>
        </Card>


        {/* Footer */}
        <footer className="mt-10 py-6 text-center text-xs text-muted-foreground">
          © 2025 CodeHealth · v1.0
        </footer>

      </div>
    </main>
  );
}
