import { AlertTriangle, Bug, Code2, ShieldCheck, Wrench } from "lucide-react";

const findings = [
  { title: "SQL injection risk", file: "apps/api/src/routes/repos.ts", severity: "Critical", icon: AlertTriangle },
  { title: "Duplicated logic", file: "apps/web/src/pages/repositories/RepositoryFindingsPage.tsx", severity: "Medium", icon: Code2 },
  { title: "Unhandled async error", file: "apps/web/src/components/layout/Topbar.tsx", severity: "Low", icon: Bug },
  { title: "Complex function path", file: "apps/api/src/services/repoService.ts", severity: "High", icon: Wrench },
];

export function GlobalFindingsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Findings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A consolidated view of the issues the platform is tracking.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          {findings.map((finding) => {
            const Icon = finding.icon;

            return (
              <article key={finding.title} className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">{finding.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{finding.file}</p>
                    <p className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{finding.severity}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
