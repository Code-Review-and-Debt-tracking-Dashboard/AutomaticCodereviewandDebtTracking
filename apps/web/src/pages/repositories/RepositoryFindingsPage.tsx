
import {
  AlertTriangle,
  Bug,
  Code2,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import {
  AlertIcon,
  FindingsIcon,
  HotspotIcon,
  RepositoriesIcon,
} from "../../components/icons";
import { useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

import { api } from "../../lib/apiClient";
import { METRIC_HELP } from "../../lib/healthBand";

import {
  BackLink,
  Badge,
  Card,
  StatCard,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  FilterBar,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
} from "../../components/ui";

interface ApiFinding {
  id: string;
  file: string | null;
  line: number | null;
  severity: string;
  category: string;
  rule: string;
  message: string;
  tool: string;
  isNew: boolean;
  debtMinutes: number;
}

interface FindingsResponse {
  snapshotId: string;
  summary: {
    total: number;
    new: number;
    carryOver: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  };
  data: ApiFinding[];
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
  const [searchParams] = useSearchParams();

  // hotspot rows link here with ?file= so only that file shows
  const [search, setSearch] = useState(searchParams.get("file") ?? "");
  const [severity, setSeverity] = useState("All");
  const [result, setResult] = useState<FindingsResponse | null>(null);
  const [repoName, setRepoName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFindings = useCallback(async () => {
    if (!repoId) return;

    setIsLoading(true);
    setError(null);
    try {
      const [detail, debt] = await Promise.all([
        api.get<{ name: string }>(`/api/repos/${repoId}`),
        // the debt endpoint is what tells us the latest snapshot
        api.get<{ snapshotId: string }>(`/api/repos/${repoId}/debt`),
      ]);
      setRepoName(detail.name);

      const res = await api.get<FindingsResponse>(
        `/api/snapshots/${debt.snapshotId}/findings`
      );
      setResult(res);
    } catch (err: any) {
      // no snapshot yet is the normal state for a freshly linked repo
      if (err?.response?.status === 404) {
        setResult(null);
      } else {
        setError(err?.response?.data?.message || "Failed to load findings.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  const findings = result?.data ?? [];

  const filteredFindings = findings.filter((finding) => {
    const haystack = `${finding.message} ${finding.file ?? ""} ${finding.rule}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesSeverity =
      severity === "All" || titleCase(finding.severity) === severity;

    return matchesSearch && matchesSeverity;
  });

  const summary = result?.summary;

  return (
    <>

      <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

      <PageHeader>
        <div>
          <PageHeaderBadge>
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
          <p className="mt-1 font-semibold">{repoName || "—"}</p>
        </div>
      </PageHeader>

      <div data-tour="finding-stats" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Findings"
          value={String(summary?.total ?? 0)}
          help={METRIC_HELP.openFindings}
          icon={FindingsIcon}
          color="danger"
        />
        <StatCard
          title="Critical"
          value={String(summary?.bySeverity?.critical ?? 0)}
          help="The most serious problems found. These should be dealt with first."
          icon={AlertIcon}
          color="danger"
        />
        <StatCard
          title="High Severity"
          value={String(summary?.bySeverity?.high ?? 0)}
          help="Serious problems, though less urgent than critical ones."
          icon={HotspotIcon}
          color="warning"
        />
        <StatCard
          title="New in this analysis"
          value={String(summary?.new ?? 0)}
          help="Problems that were not present in the previous analysis of this repository."
          icon={RepositoriesIcon}
          color="info"
        />
      </div>

      <Card data-tour="finding-list" className="mt-6">
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
              const category = titleCase(finding.category);
              const sev = titleCase(finding.severity);
              const CategoryIcon = categoryIcons[category] ?? Code2;

              return (
                <DataTableRow key={finding.id} className="hover:bg-muted/30">
                  <DataTableCell>
                    <div>
                      <p className="max-w-[360px] break-words font-medium">{finding.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{finding.rule}</p>
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <CategoryIcon size={15} className="text-primary" />
                      {category}
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        severityStyles[sev] ?? severityStyles.Low
                      }`}
                    >
                      {sev}
                    </span>
                  </DataTableCell>

                  <DataTableCell>
                    <p className="font-mono text-xs">{finding.file ?? "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {finding.line !== null ? `Line ${finding.line}` : ""}
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
                        finding.isNew
                          ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {finding.isNew ? "New" : "Carried over"}
                    </Badge>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
            
            {filteredFindings.length === 0 && (
              <DataTableRow>
                <DataTableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Loading findings…
                    </span>
                  ) : error ? (
                    <span className="text-destructive">{error}</span>
                  ) : !result ? (
                    "This repository has not been analyzed yet."
                  ) : findings.length === 0 ? (
                    "No findings — this analysis came back clean."
                  ) : (
                    "No findings match your search."
                  )}
                </DataTableCell>
              </DataTableRow>
            )}
          </DataTableBody>
        </DataTable>
      </Card>
    </>
  );
}