import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";

import {
  AlertIcon,
  CheckIcon,
  FindingsIcon,
  PullRequestIcon,
} from "../../components/icons";

import { api } from "../../lib/apiClient";
import { apiErrorMessage } from "../../lib/apiError";
import { useOrg } from "../../contexts/OrgContext";

import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from "../../components/ui";

interface PRStatData {
  totalAnalyzed: number;
  gatePassed: number;
  needsAttention: number;
  avgHealthScore: string;
  avgHealthScoreDelta: string;
}

interface PullRequestData {
  id: number;
  repoId: string;
  repoName: string;
  title: string;
  author: string;
  branch: string;
  score: number | null;
  findings: number;
  debtDelta: number;
  status: string;
  time: string;
  htmlUrl: string;
}

interface PullsResponse {
  stats: PRStatData;
  pullRequests: PullRequestData[];
}

export function GlobalPullRequestsPage() {
  const navigate = useNavigate();
  const { selectedOrg } = useOrg();
  const [data, setData] = useState<PullsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrg) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    api
      .get<PullsResponse>(`/api/orgs/${selectedOrg.id}/pulls`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(apiErrorMessage(err, "Failed to load pull requests."));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selectedOrg]);

  const stats = data?.stats || {
    totalAnalyzed: 0,
    gatePassed: 0,
    needsAttention: 0,
    avgHealthScore: "0",
    avgHealthScoreDelta: "+0m",
  };

  const pullRequests = data?.pullRequests || [];

  return (
    <>
      {/* Header */}
      <PageHeader>
        <div>
          <PageHeaderTitle>Pull Requests</PageHeaderTitle>
          <PageHeaderDescription>
            Monitor automated code reviews and quality gates across all active pull requests.
          </PageHeaderDescription>
        </div>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Open PRs"
          value={stats.totalAnalyzed.toString()}
          icon={PullRequestIcon}
          iconColor="bg-info/10 text-info"
          delay={0}
        />
        <StatCard
          title="Gate Passed"
          value={stats.gatePassed.toString()}
          icon={CheckIcon}
          iconColor="bg-success/10 text-success"
          delay={0.08}
        />
        <StatCard
          title="Needs Attention"
          value={stats.needsAttention.toString()}
          icon={AlertIcon}
          iconColor="bg-warning/10 text-warning"
          delay={0.16}
        />
        <StatCard
          title="Avg Health Score"
          value={stats.avgHealthScore}
          change={`${stats.avgHealthScoreDelta} from last week`}
          icon={FindingsIcon}
          iconColor="bg-info/10 text-info"
          delay={0.24}
        />
      </div>

      {/* Recent PR Scans */}
      <Card className="mt-6">
        <CardHeader className="border-b border-border/60">
          <CardTitle>Recent PR scans</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {isLoading ? (
              <div className="p-5 text-center text-sm text-muted-foreground">
                Loading pull requests...
              </div>
            ) : error ? (
              <div className="p-5 text-center text-sm text-destructive">
                {error}
              </div>
            ) : pullRequests.length === 0 ? (
              <div className="p-5 text-center text-sm text-muted-foreground">
                No pull requests found.
              </div>
            ) : (
              pullRequests.map((pr) => (
                <article
                  key={`${pr.repoName}-${pr.id}`}
                  onClick={() => navigate(`/repositories/${pr.repoId}/pull-requests/${pr.id}/findings`)}
                  className="flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors hover:bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {pr.repoName} #{pr.id} {pr.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      by {pr.author} into {pr.branch} &bull; {new Date(pr.time).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="muted" size="md">
                      HEALTH SCORE {pr.score ?? "—"}
                    </Badge>
                    <Badge variant="muted" size="md">
                      FINDINGS {pr.findings}
                    </Badge>
                    <Badge 
                      variant={pr.debtDelta > 0 ? "warning" : "success"} 
                      size="md"
                    >
                      {pr.debtDelta > 0 ? `+${pr.debtDelta}m debt` : `${pr.debtDelta}m debt`}
                    </Badge>
                    <Badge
                      variant={pr.status === "Passed" ? "success" : "warning"}
                      size="md"
                    >
                      {pr.status}
                    </Badge>
                    <a
                      href={pr.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Open on GitHub"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
