import { BarChart3, CheckCircle2, ShieldAlert, TrendingUp } from "lucide-react";

const stats = [
  { label: "Repositories", value: "14", icon: BarChart3, tone: "bg-primary/10 text-primary" },
  { label: "Healthy score", value: "84.2", icon: TrendingUp, tone: "bg-success/10 text-success" },
  { label: "Open findings", value: "126", icon: ShieldAlert, tone: "bg-warning/10 text-warning" },
  { label: "Passing gates", value: "10", icon: CheckCircle2, tone: "bg-info/10 text-info" },
];

export function GlobalAnalyticsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Analytics
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A quick view of organization health and delivery pressure.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
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
      </div>
    </main>
  );
}
