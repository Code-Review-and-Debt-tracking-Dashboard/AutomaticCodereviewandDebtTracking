import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  GitPullRequest,
  MessageSquareWarning,
} from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  StatCard,
} from "../../components/ui";


/* =========================================================
   PULL REQUEST DATA
========================================================= */

const pullRequests = [
  {
    id: 42,
    title: "Add repository health scoring",
    author: "Nethmi Bhagya",
    score: 91,
    findings: 3,
    status: "Passed",
  },
  {
    id: 41,
    title: "Improve analysis worker performance",
    author: "Rumesh Perera",
    score: 78,
    findings: 8,
    status: "Needs attention",
  },
  {
    id: 40,
    title: "Update authentication flow",
    author: "Vidushi Silva",
    score: 96,
    findings: 1,
    status: "Passed",
  },
];


/* =========================================================
   COMPONENT
========================================================= */

export function GlobalPullRequestsPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderTitle>Pull Requests</PageHeaderTitle>
            <PageHeaderDescription>
              High-level PR scan history across the organization.
            </PageHeaderDescription>
          </div>
        </PageHeader>


        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Analyzed PRs"
            value="128"
            icon={GitPullRequest}
            iconColor="bg-info/10 text-info"
            delay={0}
          />
          <StatCard
            title="Passed"
            value="94"
            icon={CheckCircle2}
            iconColor="bg-success/10 text-success"
            delay={0.08}
          />
          <StatCard
            title="Needs attention"
            value="22"
            icon={MessageSquareWarning}
            iconColor="bg-warning/10 text-warning"
            delay={0.16}
          />
        </div>


        {/* Recent PR Scans */}
        <Card className="mt-6">
          <CardHeader className="border-b border-border/60">
            <CardTitle>Recent PR scans</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {pullRequests.map((pr) => (
                <article
                  key={pr.id}
                  className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      #{pr.id} {pr.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pr.author}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="muted" size="md">
                      Score {pr.score}
                    </Badge>
                    <Badge variant="muted" size="md">
                      {pr.findings} findings
                    </Badge>
                    <Badge
                      variant={pr.status === "Passed" ? "success" : "warning"}
                      size="md"
                    >
                      {pr.status}
                    </Badge>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
