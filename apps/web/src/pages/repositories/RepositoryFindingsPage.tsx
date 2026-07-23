import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronLeft,
  Code2,
  Filter,
  LockKeyhole,
  Search,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";

const findings = [
  {
    id: "FND-001",
    title: "SQL query constructed using user input",
    category: "Security",
    severity: "Critical",
    file: "src/api/users.ts",
    line: 42,
    status: "Open",
    tool: "ESLint Security",
  },
  {
    id: "FND-002",
    title: "Function complexity exceeds recommended threshold",
    category: "Complexity",
    severity: "High",
    file: "src/services/analyzer.ts",
    line: 128,
    status: "Open",
    tool: "PMD",
  },
  {
    id: "FND-003",
    title: "Duplicated code block detected",
    category: "Duplication",
    severity: "Medium",
    file: "src/utils/format.ts",
    line: 76,
    status: "Open",
    tool: "jscpd",
  },
  {
    id: "FND-004",
    title: "Unused variable detected",
    category: "Code Smell",
    severity: "Low",
    file: "src/components/Table.tsx",
    line: 24,
    status: "Resolved",
    tool: "ESLint",
  },
  {
    id: "FND-005",
    title: "Missing error handling for asynchronous operation",
    category: "Maintainability",
    severity: "Medium",
    file: "src/services/repositoryApi.ts",
    line: 91,
    status: "Open",
    tool: "ESLint",
  },
];

const severityStyles: Record<string, string> = {
  Critical: "bg-danger/10 text-danger border-danger/20",
  High: "bg-warning/10 text-warning border-warning/20",
  Medium: "bg-info/10 text-info border-info/20",
  Low: "bg-muted text-muted-foreground border-border",
};

const categoryIcons: Record<string, React.ElementType> = {
  Security: LockKeyhole,
  Complexity: AlertTriangle,
  Duplication: Code2,
  "Code Smell": Bug,
  Maintainability: Wrench,
};

export function RepositoryFindingsPage() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");

  const filteredFindings = findings.filter((finding) => {
    const matchesSearch =
      finding.title.toLowerCase().includes(search.toLowerCase()) ||
      finding.file.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity =
      severity === "All" || finding.severity === severity;

    return matchesSearch && matchesSeverity;
  });

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(`/repositories/${repoId}`)}
            className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ChevronLeft size={16} />
            Back to repository
          </button>

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-danger/20 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger">
                <ShieldAlert size={13} />
                Code quality findings
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Findings
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Review and manage detected code quality, security, and
                maintainability issues.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Repository
              </p>

              <p className="mt-1 font-semibold">
                AutomaticCodeReview
              </p>
            </div>
          </div>
        </motion.div>

        {/* SUMMARY CARDS */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Total Findings",
              value: "183",
              icon: ShieldAlert,
              className: "bg-danger/10 text-danger",
            },
            {
              title: "Critical",
              value: "4",
              icon: AlertTriangle,
              className: "bg-danger/10 text-danger",
            },
            {
              title: "High Severity",
              value: "27",
              icon: Bug,
              className: "bg-warning/10 text-warning",
            },
            {
              title: "Resolved",
              value: "96",
              icon: CheckCircle2,
              className: "bg-success/10 text-success",
            },
          ].map((stat, index) => {
            const Icon = stat.icon;

            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl border border-border/70 bg-card p-5 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.className}`}
                >
                  <Icon size={20} />
                </div>

                <p className="mt-5 text-sm text-muted-foreground">
                  {stat.title}
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {stat.value}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* FINDINGS TABLE */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card"
        >
          <div className="border-b border-border/70 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={17} className="text-primary" />

                  <p className="font-semibold">
                    Detected Findings
                  </p>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Findings generated by automated code analysis tools.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search findings..."
                    className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-sm outline-none transition focus:border-primary sm:w-64"
                  />
                </div>

                <div className="relative">
                  <Filter
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />

                  <select
                    value={severity}
                    onChange={(event) =>
                      setSeverity(event.target.value)
                    }
                    className="h-10 rounded-xl border border-border bg-background pl-9 pr-4 text-sm outline-none focus:border-primary"
                  >
                    <option value="All">All severity</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Finding</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Tool</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredFindings.map((finding) => {
                  const CategoryIcon =
                    categoryIcons[finding.category] ?? Code2;

                  return (
                    <tr
                      key={finding.id}
                      className="border-b border-border/50 transition hover:bg-muted/30"
                    >
                      <td className="px-6 py-5">
                        <div>
                          <p className="max-w-[360px] font-medium">
                            {finding.title}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {finding.id}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-sm">
                          <CategoryIcon
                            size={15}
                            className="text-primary"
                          />

                          {finding.category}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${severityStyles[finding.severity]}`}
                        >
                          {finding.severity}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-mono text-xs">
                          {finding.file}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Line {finding.line}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-sm text-muted-foreground">
                        {finding.tool}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            finding.status === "Resolved"
                              ? "bg-success/10 text-success"
                              : "bg-warning/10 text-warning"
                          }`}
                        >
                          {finding.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>
    </main>
  );
}