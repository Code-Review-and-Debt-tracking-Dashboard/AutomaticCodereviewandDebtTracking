import { CheckCircle2, GitPullRequest, MessageSquareWarning, Sparkles } from "lucide-react";

const pullRequests = [
  { id: 42, title: "Add repository health scoring", author: "Nethmi Bhagya", score: 91, findings: 3, status: "Passed" },
  { id: 41, title: "Improve analysis worker performance", author: "Rumesh Perera", score: 78, findings: 8, status: "Needs attention" },
  { id: 40, title: "Update authentication flow", author: "Vidushi Silva", score: 96, findings: 1, status: "Passed" },
];

export function GlobalPullRequestsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pull Requests
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            High-level PR scan history across the organization.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Analyzed PRs", value: "128", icon: GitPullRequest, tone: "bg-info/10 text-info" },
            { label: "Passed", value: "94", icon: CheckCircle2, tone: "bg-success/10 text-success" },
            { label: "Needs attention", value: "22", icon: MessageSquareWarning, tone: "bg-warning/10 text-warning" },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <article key={stat.label} className="rounded-2xl border border-border/70 bg-card p-5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.tone}`}>
                  <Icon size={20} />
                </div>
                <p className="mt-5 text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold">{stat.value}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="border-b border-border/70 p-5">
            <p className="font-semibold">Recent PR scans</p>
          </div>
          <div className="divide-y divide-border/60">
            {pullRequests.map((pr) => (
              <article key={pr.id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold">#{pr.id} {pr.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{pr.author}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="rounded-full bg-muted px-2.5 py-1">Score {pr.score}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1">{pr.findings} findings</span>
                  <span className={`rounded-full px-2.5 py-1 ${pr.status === "Passed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {pr.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
