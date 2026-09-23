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
  Code2,
  GitPullRequest,
  LockKeyhole,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import {
  AlertIcon,
  CheckIcon,
  FindingsIcon,
  HotspotIcon,
} from "../../components/icons";
import { api } from "../../lib/apiClient";

import {
  BackLink,
  Badge,
  Card,
  IconBox,
  StatCard,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  FilterBar,
} from "../../components/ui";


const severityStyles: Record<string, string> = {
  Critical: "bg-danger/10 text-danger border-danger/20",
  High: "bg-warning/10 text-warning border-warning/20",
  Medium: "bg-info/10 text-info border-info/20",
  Low: "bg-muted text-muted-foreground border-border",
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
}

export function PRFindingDrilldownPage() {
  const { repoId, prNumber } = useParams();

  const [realFindings, setRealFindings] = useState<FindingItem[]>([]);
  const [hasAnalysis, setHasAnalysis] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [category, setCategory] = useState("All");
  const [state, setState] = useState("All");

  useEffect(() => {
    if (!repoId || !prNumber) return;

    const fetchPrFindings = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        // the PR endpoint carries snapshots, not findings — the newest one
        // points at the findings for this PR's latest analysis
        const pr = await api.get<{ snapshots: { id: string; createdAt: string }[] }>(
          `/api/repos/${repoId}/pulls/${prNumber}`
        );
        const latest = [...(pr.snapshots ?? [])].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        )[0];

        if (!latest) {
          setRealFindings([]);
          setHasAnalysis(false);
          return;
        }

        const res = await api.get<{
          data: {
            id: string;
            file: string | null;
            line: number | null;
            severity: string;
            category: string;
            rule: string;
            message: string;
            tool: string;
            isNew: boolean;
          }[];
        }>(`/api/snapshots/${latest.id}/findings`);

        setHasAnalysis(true);
        setRealFindings(
          (res.data ?? []).map((f) => ({
            id: f.id,
            message: f.message,
            category: f.category,
            severity: f.severity,
            file: f.file ?? "",
            line: f.line ?? 0,
            state: f.isNew ? "NEW" : "EXISTING",
            tool: f.tool,
            rule: f.rule,
          }))
        );
      } catch (err: any) {
        setLoadError(err?.response?.data?.message || "Failed to load findings for this pull request.");
        setRealFindings([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrFindings();
  }, [repoId, prNumber]);

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
    <>

      <BackLink to={`/repositories/${repoId}/pull-requests`} label="Back to pull requests" />

      <PageHeader>
        <div>
          <PageHeaderBadge>
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
          value="4"
          icon={FindingsIcon}
          color="primary"
        />
        <StatCard
          title="Critical"
          value="1"
          icon={AlertIcon}
          color="danger"
        />
        <StatCard
          title="New"
          value="2"
          icon={HotspotIcon}
          color="warning"
        />
        <StatCard
          title="Resolved"
          value="1"
          icon={CheckIcon}
          color="success"
        />
      </div>

      <Card className="mt-6">
        <div className="border-b border-border/70 p-5">
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
                options: ["All", "New", "Existing", "Resolved"],
              },
            ]}
          />
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
              <p className="text-sm font-semibold">
                {isLoading
                  ? "Loading findings…"
                  : loadError
                    ? "Could not load findings"
                    : !hasAnalysis
                      ? "This pull request has not been analyzed yet"
                      : realFindings.length === 0
                        ? "No findings — this analysis came back clean"
                        : "No findings match your criteria"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {loadError ?? (realFindings.length > 0 ? "Try adjusting your search or filters." : "")}
              </p>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
