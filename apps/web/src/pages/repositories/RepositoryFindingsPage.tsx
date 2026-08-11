import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Code2,
  LockKeyhole,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useState } from "react";

import {
  BackLink,
  Badge,
  Card,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  FilterBar,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  StatCard,
} from "../../components/ui";

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

        <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

        <PageHeader>
          <div>
            <PageHeaderBadge className="border-danger/20 bg-danger/10 text-danger">
              <ShieldAlert size={13} />
              Code quality findings
            </PageHeaderBadge>

            <PageHeaderTitle>Findings</PageHeaderTitle>

            <PageHeaderDescription>
              Review and manage detected code quality, security, and maintainability issues.
            </PageHeaderDescription>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Repository</p>
            <p className="mt-1 font-semibold">AutomaticCodeReview</p>
          </div>
        </PageHeader>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Findings"
            value="183"
            icon={ShieldAlert}
            color="danger"
          />
          <StatCard
            title="Critical"
            value="4"
            icon={AlertTriangle}
            color="danger"
          />
          <StatCard
            title="High Severity"
            value="27"
            icon={Bug}
            color="warning"
          />
          <StatCard
            title="Resolved"
            value="96"
            icon={CheckCircle2}
            color="success"
          />
        </div>

        <Card className="mt-6">
          <div className="border-b border-border/70 p-5">
            <FilterBar
              searchPlaceholder="Search findings..."
              searchValue={search}
              onSearchChange={setSearch}
              filters={[
                {
                  value: severity,
                  onChange: setSeverity,
                  options: ["All", "Critical", "High", "Medium", "Low"],
                },
              ]}
            />
          </div>

          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Finding</DataTableHeaderCell>
                <DataTableHeaderCell>Category</DataTableHeaderCell>
                <DataTableHeaderCell>Severity</DataTableHeaderCell>
                <DataTableHeaderCell>Location</DataTableHeaderCell>
                <DataTableHeaderCell>Tool</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {filteredFindings.map((finding) => {
                const CategoryIcon = categoryIcons[finding.category] ?? Code2;

                return (
                  <DataTableRow key={finding.id} className="hover:bg-muted/30">
                    <DataTableCell>
                      <div>
                        <p className="max-w-[360px] font-medium">{finding.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{finding.id}</p>
                      </div>
                    </DataTableCell>

                    <DataTableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <CategoryIcon size={15} className="text-primary" />
                        {finding.category}
                      </div>
                    </DataTableCell>

                    <DataTableCell>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          severityStyles[finding.severity]
                        }`}
                      >
                        {finding.severity}
                      </span>
                    </DataTableCell>

                    <DataTableCell>
                      <p className="font-mono text-xs">{finding.file}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Line {finding.line}
                      </p>
                    </DataTableCell>

                    <DataTableCell>
                      <span className="text-sm text-muted-foreground">
                        {finding.tool}
                      </span>
                    </DataTableCell>

                    <DataTableCell>
                      <Badge
                        variant="muted"
                        className={
                          finding.status === "Resolved"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }
                      >
                        {finding.status}
                      </Badge>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
              
              {filteredFindings.length === 0 && (
                <DataTableRow>
                  <DataTableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No findings match your search.
                  </DataTableCell>
                </DataTableRow>
              )}
            </DataTableBody>
          </DataTable>
        </Card>
      </div>
    </main>
  );
}