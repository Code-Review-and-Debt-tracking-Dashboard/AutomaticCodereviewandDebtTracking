import { Bot, Sparkles, Zap, ArrowRight } from "lucide-react";

export function AiCopilotPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI Copilot
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Draft review prompts, summarize findings, and turn analysis into action.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles size={14} />
            Copilot preview
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot size={20} />
              </div>
              <div>
                <p className="font-semibold">Suggested prompt</p>
                <p className="text-xs text-muted-foreground">Use this as the starting point for a review</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border/70 bg-background p-4 text-sm leading-6 text-muted-foreground">
              Summarize the five highest-risk findings in this repository and explain which ones should block the quality gate.
            </div>

            <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
              Generate summary
              <ArrowRight size={16} />
            </button>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Zap size={16} className="text-primary" />
              Copilot suggestions
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="rounded-xl bg-muted/40 p-3">Explain the biggest score drop in the last week.</li>
              <li className="rounded-xl bg-muted/40 p-3">Draft a PR comment for the latest analysis result.</li>
              <li className="rounded-xl bg-muted/40 p-3">List files that should be prioritized for remediation.</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
