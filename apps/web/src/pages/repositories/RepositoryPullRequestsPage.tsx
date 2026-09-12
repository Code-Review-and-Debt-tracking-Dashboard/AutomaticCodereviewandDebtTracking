import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  GitPullRequest,
  MessageSquareWarning,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { api } from "../../lib/apiClient";

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

/* =========================================================
   TYPES
========================================================= */

interface PullItem {
  id: number;
  title: string;
  author: string;
  branch: string;
  score: number;
  findings: number;
  debtDelta: number;
  status: string;
  time: string;
}

/* =========================================================
   COMPONENT
========================================================= */

export function RepositoryPullRequestsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  
  const [prs, setPrs] = useState<PullItem[]>([]);
  const [_isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!repoId) return;

    const fetchPulls = async () => {
      setIsLoading(true);
      try {
        const res = await api.get<{ data: PullItem[] }>(`/api/repos/${repoId}/pulls`);
        setPrs(res?.data || []);
      } catch {
        setPrs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPulls();
  }, [repoId]);

  const pullRequests = prs;
  const analyzedCount = prs.filter((pr) => pr.status !== "Pending").length;
  const passedCount = prs.filter((pr) => pr.status === "Passed").length;
  const needsAttentionCount = prs.filter((pr) => pr.status === "Needs attention").length;
  const averageScore = analyzedCount
    ? (prs.filter((pr) => pr.status !== "Pending").reduce((sum, pr) => sum + pr.score, 0) / analyzedCount).toFixed(1)
    : "0.0";

  const filteredPRs = pullRequests.filter((pr) => {
    const matchesSearch =
      pr.title.toLowerCase().includes(search.toLowerCase()) ||
      pr.author.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <main data-dashboard-page className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        
        <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

        <PageHeader>
          <div>
            <PageHeaderBadge className="border-info/20 bg-info/10 text-info">
              <GitPullRequest size={13} />
              Pull request intelligence
            </PageHeaderBadge>

            <PageHeaderTitle>Pull Requests</PageHeaderTitle>

            <PageHeaderDescription>
              Review code quality results from analyzed pull requests.
            </PageHeaderDescription>
          </div>
        </PageHeader>


        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Analyzed PRs"
            value={String(analyzedCount)}
            icon={GitPullRequest}
            color="info"
          />
          <StatCard
            title="Passed Quality Gate"
            value={String(passedCount)}
            icon={CheckCircle2}
            color="success"
          />
          <StatCard
            title="Needs Attention"
            value={String(needsAttentionCount)}
            icon={MessageSquareWarning}
            color="warning"
          />
          <StatCard
            title="Average Score"
            value={averageScore}
            icon={Sparkles}
            color="primary"
          />
        </div>

        <Card className="mt-6">
          <div className="border-b border-border/70 p-5">
            <div data-dashboard-filters>
            <FilterBar
              searchPlaceholder="Search pull requests..."
              searchValue={search}
              onSearchChange={setSearch}
            />
            </div>
          </div>

          <div data-dashboard-table>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Pull Request</DataTableHeaderCell>
                <DataTableHeaderCell>Author & Branch</DataTableHeaderCell>
                <DataTableHeaderCell>Health Score</DataTableHeaderCell>
                <DataTableHeaderCell>Findings</DataTableHeaderCell>
                <DataTableHeaderCell>Debt Delta</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            
            <DataTableBody>
              {filteredPRs.map((pr) => (
                <DataTableRow 
                  key={pr.id} 
                  onClick={() => navigate(`/repositories/${repoId}/pull-requests/${pr.id}/findings`)}
                  className="cursor-pointer hover:bg-muted/30"
                >
                  <DataTableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
                        <GitPullRequest size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          #{pr.id} {pr.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(pr.time).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <div className="text-sm font-medium">{pr.author}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{pr.branch}</div>
                  </DataTableCell>

                  <DataTableCell>
                    <div
                      className={`text-sm font-bold ${
                        pr.score >= 85 ? "text-success" : "text-warning"
                      }`}
                    >
                      {pr.score}
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <div className="text-sm font-medium">{pr.findings}</div>
                  </DataTableCell>

                  <DataTableCell>
                    <div
                      className={`text-sm font-bold ${
                        pr.debtDelta <= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {pr.debtDelta > 0 ? `+${pr.debtDelta}m` : `${pr.debtDelta}m`}
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <Badge
                      variant="muted"
                      className={
                        pr.status === "Passed"
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }
                    >
                      {pr.status === "Passed" ? (
                        <CheckCircle2 size={13} className="mr-1.5" />
                      ) : (
                        <ShieldAlert size={13} className="mr-1.5" />
                      )}
                      {pr.status}
                    </Badge>
                  </DataTableCell>
                </DataTableRow>
              ))}
              
              {filteredPRs.length === 0 && (
                <DataTableRow>
                  <DataTableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No pull requests found.
                  </DataTableCell>
                </DataTableRow>
              )}
            </DataTableBody>
          </DataTable>
          </div>
        </Card>
      </div>
    </main>
  );
}