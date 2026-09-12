import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const categoryIcons: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  Security: LockKeyhole,
  Complexity: AlertTriangle,
  Duplication: Code2,
  "Code Smell": Bug,
  Maintainability: Wrench,
};
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Code2,
  GitPullRequest,
  LockKeyhole,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { api } from "../../lib/apiClient";

import {
  BackLink,
  Badge,
  Card,
  FilterBar,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  StatCard,
  IconBox,
} from "../../components/ui";

const severityStyles: Record<string, string> = {
  Critical: "bg-danger/10 text-danger border-danger/20",
  High: "bg-warning/10 text-warning border-warning/20",
  Medium: "bg-info/10 text-info border-info/20",
  Low: "bg-muted text-muted-foreground border-border",
};

const categoryLabels: Record<string, string> = {
  VULNERABILITY: "Security",
  COMPLEXITY: "Complexity",
  DUPLICATION: "Duplication",
  CODE_SMELL: "Code Smell",
  MAINTAINABILITY: "Maintainability",
};

const severityLabels: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  INFO: "Info",
};

interface FindingItem {
  id: string;
  message: string;
  category: string;
  severity: string;
  file: string;
  line: number;
  state: string;
  tool: string;
  rule?: string;
  isNew?: boolean;
  debtMinutes?: number;
}

interface FindingResponse {
  summary: { total: number; new: number; carryOver: number };
  data: Array<{
    id: string;
    file: string | null;
    line: number | null;
    severity: string;
    category: string;
    rule: string | null;
    message: string;
    tool: string;
    isNew: boolean;
    debtMinutes: number;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function PRFindingDrilldownPage() {
  const { repoId, prNumber } = useParams();

  const [realFindings, setRealFindings] = useState<FindingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState({ total: 0, new: 0, carryOver: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [category, setCategory] = useState("All");
  const [state, setState] = useState("All");

  useEffect(() => {
    if (!repoId || !prNumber) return;

    const fetchPrFindings = async () => {
      setIsLoading(true);
      try {
        const detail = await api.get<{ snapshots: Array<{ id: string }> }>(
          `/api/repos/${repoId}/pulls/${prNumber}`
        );
        const snapshotId = detail.snapshots[0]?.id;
        if (!snapshotId) {
          setRealFindings([]);
          setSummary({ total: 0, new: 0, carryOver: 0 });
          return;
        }

        const res = await api.get<FindingResponse>(
          `/api/snapshots/${snapshotId}/findings`,
          { page, limit: 50 },
        );
        setSummary(res.summary);
        setRealFindings(res.data.map((finding) => ({
          id: finding.id,
          message: finding.message,
          category: categoryLabels[finding.category] ?? finding.category,
          severity: severityLabels[finding.severity] ?? finding.severity,
          file: finding.file ?? "unknown file",
          line: finding.line ?? 0,
          state: finding.isNew ? "New" : "Existing",
          tool: finding.tool,
          rule: finding.rule ?? undefined,
          isNew: finding.isNew,
          debtMinutes: finding.debtMinutes,
        })));
      } catch {
        setRealFindings([]);
        setSummary({ total: 0, new: 0, carryOver: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrFindings();
  }, [repoId, prNumber, page]);

  const activeFindings = realFindings;

  const filteredFindings = activeFindings.filter((finding) => {
    const matchesSearch =
      finding.message.toLowerCase().includes(search.toLowerCase()) ||
      finding.file.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity = severity === "All" || finding.severity === severity;
    const matchesCategory = category === "All" || finding.category === category;
    const matchesState = state === "All" || finding.state === state;

    return matchesSearch && matchesSeverity && matchesCategory && matchesState;
  });

  return (
    <main data-dashboard-page className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">

        <BackLink to={`/repositories/${repoId}/pull-requests`} label="Back to pull requests" />

        <PageHeader>
          <div>
            <PageHeaderBadge className="border-info/20 bg-info/10 text-info">
              <GitPullRequest size={13} />
              Pull Request Analysis
            </PageHeaderBadge>

            <PageHeaderTitle>PR #{prNumber} Findings</PageHeaderTitle>

            <PageHeaderDescription>
              Review specific code quality issues introduced or resolved in this pull request.
            </PageHeaderDescription>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Author</p>
            <p className="mt-1 font-semibold">seed-developer</p>
          </div>
        </PageHeader>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Findings"
            value={String(summary.total)}
            icon={ShieldAlert}
            color="primary"
          />
          <StatCard
            title="Critical"
            value={String(activeFindings.filter((finding) => finding.severity === "CRITICAL").length)}
            icon={AlertTriangle}
            color="danger"
          />
          <StatCard
            title="New"
            value={String(summary.new)}
            icon={Bug}
            color="warning"
          />
          <StatCard
            title="Resolved"
            value={String(summary.carryOver)}
            icon={CheckCircle2}
            color="success"
          />
        </div>

        <Card className="mt-6">
          <div className="border-b border-border/70 p-5">
            <div data-dashboard-filters>
            <FilterBar
              searchPlaceholder="Search findings by message or file..."
              searchValue={search}
              onSearchChange={setSearch}
              filters={[
                {
                  value: severity,
                  onChange: setSeverity,
                  options: ["All", "Critical", "High", "Medium", "Low"],
                },
                {
                  value: category,
                  onChange: setCategory,
                  options: ["All", "Security", "Complexity", "Duplication", "Code Smell", "Maintainability"],
                },
                {
                  value: state,
                  onChange: setState,
                  options: ["All", "New", "Existing"],
                },
              ]}
            />
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {filteredFindings.map((finding) => {
              const CategoryIcon = categoryIcons[finding.category] ?? Code2;

              return (
                <div key={finding.id} className="p-5 sm:p-6 transition hover:bg-muted/30">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    
                    <div className="flex gap-4">
                      <IconBox 
                        icon={CategoryIcon} 
                        color={finding.severity === "Critical" ? "danger" : finding.severity === "High" ? "warning" : "info"} 
                      />
                      
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="font-semibold text-foreground">{finding.message}</h4>
                          <Badge
                            variant="muted"
                            className={
                              finding.state === "Resolved"
                                ? "bg-success/10 text-success"
                                : finding.state === "New"
                                ? "bg-warning/10 text-warning"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {finding.state}
                          </Badge>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold ${
                              severityStyles[finding.severity]
                            }`}
                          >
                            {finding.severity}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          <span className="font-mono text-primary">
                            {finding.file}:{finding.line}
                          </span>
                          <span className="flex items-center gap-1">
                            • Rule: <span className="font-medium text-foreground">{finding.rule}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            • Tool: <span className="font-medium text-foreground">{finding.tool}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            • Category: <span className="font-medium text-foreground">{finding.category}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredFindings.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <ShieldAlert size={32} className="text-muted-foreground mb-4" />
                <p className="text-sm font-semibold">No findings match your criteria</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting your search or filters.
                </p>
              </div>
            )}
          </div>
          {realFindings.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/60 p-4 text-sm">
              <span className="text-muted-foreground">Page {page}</span>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded border border-border px-3 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={realFindings.length < 50}
                onClick={() => setPage((current) => current + 1)}
                className="rounded border border-border px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
