import { Bot, Sparkles, Zap, ArrowRight } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardTitle,
  CardDescription,
  IconBox,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
} from "../../components/ui";


/* =========================================================
   COMPONENT
========================================================= */

export function AiCopilotPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderTitle>AI Copilot</PageHeaderTitle>
            <PageHeaderDescription>
              Draft review prompts, summarize findings, and turn analysis into action.
            </PageHeaderDescription>
          </div>

          <PageHeaderActions>
            <Badge variant="outline" size="lg">
              <Sparkles size={14} />
              Copilot preview
            </Badge>
          </PageHeaderActions>
        </PageHeader>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">

          {/* Suggested Prompt Card */}
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <IconBox icon={Bot} color="primary" size="md" />
              <div>
                <CardTitle>Suggested prompt</CardTitle>
                <CardDescription>Use this as the starting point for a review</CardDescription>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border/70 bg-background p-4 text-sm leading-6 text-muted-foreground">
              Summarize the five highest-risk findings in this repository and explain which ones should block the quality gate.
            </div>

            <Button className="mt-5">
              Generate summary
              <ArrowRight size={16} />
            </Button>
          </Card>

          {/* Copilot Suggestions Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Zap size={16} className="text-primary" />
              Copilot suggestions
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="rounded-xl bg-muted/40 p-3">Explain the biggest score drop in the last week.</li>
              <li className="rounded-xl bg-muted/40 p-3">Draft a PR comment for the latest analysis result.</li>
              <li className="rounded-xl bg-muted/40 p-3">List files that should be prioritized for remediation.</li>
            </ul>
          </Card>

        </div>
      </div>
    </main>
  );
}
