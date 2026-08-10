import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  Settings2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  FilterBar,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  Select,
  StatCard,
} from "../../components/ui";


/* =========================================================
   FINDINGS DATA
========================================================= */

const findings = [
  {
    id: "FND-001",
    title: "SQL query constructed using raw user input string concatenation",
    file: "src/api/users.ts:42",
    tool: "ESLint Security",
    suggestion: "Use parameterized query bindings.",
    severity: "Critical" as const,
    repoName: "AutomaticCodeReview",
  },
  {
    id: "FND-002",
    title: "Function cyclomatic complexity exceeds maximum threshold (18)",
    file: "src/services/analyzer.ts:128",
    tool: "PMD",
    suggestion: "Decompose into sub-functions.",
    severity: "High" as const,
    repoName: "MobileDashboard",
  },
  {
    id: "FND-003",
    title: "Duplicated code block detected (42 lines across two files)",
    file: "src/utils/format.ts:76",
    tool: "jscpd",
    suggestion: "Extract shared utility helper.",
    severity: "Medium" as const,
    repoName: "AutomaticCodeReview",
  },
  {
    id: "FND-004",
    title: "Hardcoded timeout constant in Redis worker connection",
    file: "src/worker/redis.py:24",
    tool: "Bandit",
    suggestion: "Move value to environment variable.",
    severity: "Low" as const,
    repoName: "AnalysisWorker",
  },
  {
    id: "FND-005",
    title: "Missing error handling for asynchronous fetch operation",
    file: "src/hooks/useData.ts:55",
    tool: "ESLint",
    suggestion: "Add try-catch block and handle failures.",
    severity: "Medium" as const,
    repoName: "MobileDashboard",
  },
];


/* =========================================================
   SEVERITY BADGE VARIANTS
========================================================= */

const severityVariant: Record<string, "destructive" | "warning" | "info" | "muted"> = {
  Critical: "destructive",
  High: "warning",
  Medium: "info",
  Low: "muted",
};


/* =========================================================
   COMPONENT
========================================================= */

export function GlobalFindingsPage() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [repoFilter, setRepoFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");


  const filtered = useMemo(() => {
    return findings.filter((f) => {
      const matchesSearch =
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.file.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRepo = repoFilter === "All" || f.repoName === repoFilter;
      const matchesSeverity = severityFilter === "All" || f.severity === severityFilter;
      return matchesSearch && matchesRepo && matchesSeverity;
    });
  }, [searchQuery, repoFilter, severityFilter]);


  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderBadge>
              <ShieldCheck size={13} />
              Security & Code Debt
            </PageHeaderBadge>

            <PageHeaderTitle>All Findings</PageHeaderTitle>

            <PageHeaderDescription>
              Review and prioritize code quality, security, and maintainability findings across all repositories.
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
            title="Total Findings"
            value="183"
            change="-14 this week"
            trend="down"
            icon={ShieldAlert}
            iconColor="bg-primary/10 text-primary"
            delay={0}
          />
          <StatCard
            title="Critical Vulnerabilities"
            value="4"
            change="Immediate action required"
            trend="neutral"
            icon={AlertTriangle}
            iconColor="bg-destructive/10 text-destructive"
            delay={0.08}
          />
          <StatCard
            title="High Severity"
            value="27"
            change="Needs scheduling"
            trend="neutral"
            icon={Settings2}
            iconColor="bg-warning/10 text-warning"
            delay={0.16}
          />
          <StatCard
            title="Resolved Issues"
            value="96"
            change="In the last 30 days"
            trend="up"
            icon={CheckCircle2}
            iconColor="bg-success/10 text-success"
            delay={0.24}
          />
        </div>


        {/* Search + Filters */}
        <div className="mt-6">
          <FilterBar
            placeholder="Search findings by title, file path, repository..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
          >
            <Select
              value={repoFilter}
              onChange={setRepoFilter}
              options={[
                { label: "All Repositories", value: "All" },
                { label: "AutomaticCodeReview", value: "AutomaticCodeReview" },
                { label: "MobileDashboard", value: "MobileDashboard" },
                { label: "AnalysisWorker", value: "AnalysisWorker" },
              ]}
            />
            <Select
              value={severityFilter}
              onChange={setSeverityFilter}
              options={[
                { label: "All Severities", value: "All" },
                { label: "Critical", value: "Critical" },
                { label: "High", value: "High" },
                { label: "Medium", value: "Medium" },
                { label: "Low", value: "Low" },
              ]}
            />
          </FilterBar>
        </div>


        {/* Findings List */}
        <div className="mt-6 space-y-3">
          {filtered.map((finding) => (
            <Card key={finding.id} className="transition hover:border-primary/40">
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  {/* Tags */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="default" size="sm">
                      {finding.repoName}
                    </Badge>
                    <Badge variant={severityVariant[finding.severity] ?? "muted"} size="sm">
                      {finding.severity}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {finding.id}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="text-sm font-semibold leading-snug">
                    {finding.title}
                  </p>

                  {/* Meta */}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {finding.file}
                    <span className="mx-1.5">•</span>
                    Tool: {finding.tool}
                    <span className="mx-1.5">•</span>
                    {finding.suggestion}
                  </p>
                </div>

                {/* Action */}
                <button
                  className="
                    inline-flex shrink-0 items-center gap-1.5
                    rounded-xl border border-border bg-card
                    px-3 py-2 text-xs font-medium
                    transition hover:border-primary/40 hover:bg-muted
                  "
                >
                  View in Repository
                  <ExternalLink size={12} />
                </button>
              </div>
            </Card>
          ))}
        </div>

      </div>
    </main>
  );
}
