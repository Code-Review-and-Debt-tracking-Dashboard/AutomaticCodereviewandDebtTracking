import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  CheckCircle2,
  Code2,
  ExternalLink,
  GitPullRequest,
  Plus,
  Search,
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

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  FilterBar,
  IconBox,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  Select,
  StatCard,
} from "../../components/ui";


/* =========================================================
   HEALTH TREND DATA
========================================================= */

const healthTrend = [
  { name: "Mon", score: 68 },
  { name: "Tue", score: 71 },
  { name: "Wed", score: 70 },
  { name: "Thu", score: 76 },
  { name: "Fri", score: 79 },
  { name: "Sat", score: 82 },
  { name: "Sun", score: 86 },
];


/* =========================================================
   REPOSITORY DATA
========================================================= */

const repositories = [
  {
    name: "AutomaticCodeReview",
    language: "TypeScript",
    score: 86,
    findings: 24,
    debt: "4h 20m",
    status: "Healthy",
  },
  {
    name: "MobileDashboard",
    language: "TypeScript",
    score: 74,
    findings: 47,
    debt: "8h 45m",
    status: "Needs attention",
  },
  {
    name: "AnalysisWorker",
    language: "Python",
    score: 91,
    findings: 12,
    debt: "2h 10m",
    status: "Excellent",
  },
];


/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

const stats = [
  {
    title: "Repositories",
    value: "12",
    change: "+2 this month",
    trend: "up" as const,
    icon: Code2,
    iconColor: "bg-primary/10 text-primary",
  },
  {
    title: "Average Health",
    value: "84.6",
    change: "+8.2% this week",
    trend: "up" as const,
    icon: TrendingUp,
    iconColor: "bg-success/10 text-success",
  },
  {
    title: "Open Findings",
    value: "183",
    change: "-24 this week",
    trend: "down" as const,
    icon: ShieldAlert,
    iconColor: "bg-warning/10 text-warning",
  },
  {
    title: "Technical Debt",
    value: "42h",
    change: "-6h this week",
    trend: "down" as const,
    icon: Wrench,
    iconColor: "bg-info/10 text-info",
  },
];


/* =========================================================
   RECENT ACTIVITY
========================================================= */

const recentActivity = [
  {
    icon: CheckCircle2,
    title: "Analysis completed",
    description: "AutomaticCodeReview passed quality analysis",
    time: "8 min ago",
    iconColor: "text-success bg-success/10",
  },
  {
    icon: GitPullRequest,
    title: "Pull request analyzed",
    description: "PR #42 introduced 3 new findings",
    time: "32 min ago",
    iconColor: "text-info bg-info/10",
  },
  {
    icon: ShieldAlert,
    title: "Security finding detected",
    description: "MobileDashboard flagged a new high severity issue",
    time: "1 hr ago",
    iconColor: "text-warning bg-warning/10",
  },
];


/* =========================================================
   DASHBOARD PAGE
========================================================= */

export function DashboardPage() {

  const navigate = useNavigate();

  /* Search + Filter State */
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("All");
  const [scoreFilter, setScoreFilter] = useState("All");


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
        (scoreFilter === "Excellent" && repo.score >= 85) ||
        (scoreFilter === "Needs attention" && repo.score < 85);

      return matchesSearch && matchesLanguage && matchesScore;
    });
  }, [searchQuery, languageFilter, scoreFilter]);


  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">

        {/* =====================================================
            PAGE HEADER
        ====================================================== */}

        <PageHeader>
          <div>
            <PageHeaderBadge>
              <Sparkles size={13} />
              Repository intelligence
            </PageHeaderBadge>

            <PageHeaderTitle>
              Good evening, Nethmi
            </PageHeaderTitle>

            <PageHeaderDescription>
              Here is the latest overview of your code quality and technical debt.
            </PageHeaderDescription>
          </div>

          <PageHeaderActions>
            <Button onClick={() => navigate("/repositories")}>
              <Code2 size={17} />
              Add repository
            </Button>
          </PageHeaderActions>
        </PageHeader>


        {/* =====================================================
            STAT CARDS
        ====================================================== */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              change={stat.change}
              trend={stat.trend}
              icon={stat.icon}
              iconColor={stat.iconColor}
              delay={index * 0.08}
            />
          ))}
        </div>


        {/* =====================================================
            HEALTH TREND + RECENT ACTIVITY
        ====================================================== */}

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
                  <CardTitle>Health Score Trend</CardTitle>
                  <CardDescription>
                    Average repository health over the last 7 days
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">86</p>
                  <p className="text-xs text-success">+18 points</p>
                </div>
              </CardHeader>

              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={healthTrend}>
                      <defs>
                        <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
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

                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        fill="url(#healthGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
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
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest repository events</CardDescription>
                </div>
                <button
                  onClick={() => navigate("/notifications")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all
                </button>
              </CardHeader>

              <CardContent>
                <div className="space-y-5">
                  {recentActivity.map((activity) => {
                    const Icon = activity.icon;

                    return (
                      <div key={activity.title} className="flex gap-3">
                        <IconBox
                          icon={Icon}
                          size="sm"
                          className={activity.iconColor}
                        />

                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {activity.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
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
              </CardContent>
            </Card>
          </motion.div>

        </div>


        {/* =====================================================
            REPOSITORY HEALTH
        ====================================================== */}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-6"
        >
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Repository Health</CardTitle>
                <CardDescription>Monitor your connected repositories</CardDescription>
              </div>
              <button
                onClick={() => navigate("/repositories")}
                className="text-xs font-medium text-primary hover:underline"
              >
                View repositories
              </button>
            </CardHeader>

            <CardContent>
              {/* Search + Filters */}
              <FilterBar
                placeholder="Search repositories..."
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                className="mb-6"
              >
                <Select
                  value={languageFilter}
                  onChange={setLanguageFilter}
                  options={[
                    { label: "All Languages", value: "All" },
                    { label: "TypeScript", value: "TypeScript" },
                    { label: "Python", value: "Python" },
                  ]}
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
                  <Plus size={16} />
                  Link Repository
                </Button>
              </FilterBar>


              {/* Repository Rows */}
              <div className="grid gap-3">
                {filteredRepositories.length > 0 ? (
                  filteredRepositories.map((repo) => (
                    <div
                      key={repo.name}
                      className="
                        group flex flex-col gap-4 rounded-xl border-2
                        border-border p-4 transition
                        hover:border-primary/70 hover:bg-muted/60
                        sm:flex-row sm:items-center
                      "
                    >
                      {/* Repo Info */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <IconBox icon={Code2} color="primary" size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {repo.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {repo.language}
                          </p>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Health
                          </p>
                          <p className={`mt-1 text-lg font-bold ${repo.score >= 85 ? "text-success" : "text-warning"}`}>
                            {repo.score}
                          </p>
                        </div>

                        <div className="hidden sm:block">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Findings
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {repo.findings}
                          </p>
                        </div>

                        <div className="hidden md:block">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Debt
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {repo.debt}
                          </p>
                        </div>

                        <Badge
                          variant={repo.score >= 85 ? "success" : "warning"}
                          size="md"
                        >
                          {repo.status}
                        </Badge>

                        <div className="hidden items-center gap-2 lg:flex">
                          <button className="text-xs text-muted-foreground hover:text-primary">
                            <Search size={14} />
                          </button>
                          <button
                            onClick={() => navigate("/repositories")}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            View <ExternalLink size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center">
                    <p className="text-sm font-medium">
                      No repositories found
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try changing your search or filters.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>


        {/* =====================================================
            FOOTER
        ====================================================== */}

        <footer className="mt-10 py-6 text-center text-xs text-muted-foreground">
          © 2025 CodeHealth · v1.0
        </footer>

      </div>
    </main>
  );
}