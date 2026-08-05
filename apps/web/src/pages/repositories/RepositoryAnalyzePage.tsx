import { ChevronLeft, ScanSearch, PlayCircle, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const analysisSteps = [
  "Clone repository into the worker sandbox",
  "Run analyzers and normalize findings",
  "Persist HealthSnapshot and return the result",
];

export function RepositoryAnalyzePage() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        <button
          onClick={() => navigate(`/repositories/${repoId}`)}
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Back to repository
        </button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Analyze
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Trigger a manual scan for this repository and follow the worker path.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            <PlayCircle size={16} />
            Run analysis
          </button>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanSearch size={16} className="text-primary" />
              Analysis pipeline
            </div>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              {analysisSteps.map((step, index) => (
                <li key={step} className="rounded-xl border border-border/70 bg-background p-3">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} className="text-primary" />
              Latest run
            </div>
            <div className="mt-4 rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
              No manual run has been started yet for repository {repoId}.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
