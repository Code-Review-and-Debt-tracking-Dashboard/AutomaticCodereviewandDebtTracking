import { ScanSearch, PlayCircle, Sparkles } from "lucide-react";
import { useParams } from "react-router-dom";

import {
  BackLink,
  Button,
  Card,
  CardTitle,
  CardContent,
  IconBox,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
} from "../../components/ui";


/* =========================================================
   DATA
========================================================= */

const analysisSteps = [
  "Clone repository into the worker sandbox",
  "Run analyzers and normalize findings",
  "Persist HealthSnapshot and return the result",
];


/* =========================================================
   COMPONENT
========================================================= */

export function RepositoryAnalyzePage() {
  const { repoId } = useParams();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderTitle>Analyze</PageHeaderTitle>
            <PageHeaderDescription>
              Trigger a manual scan for this repository and follow the worker path.
            </PageHeaderDescription>
          </div>

          <PageHeaderActions>
            <Button>
              <PlayCircle size={16} />
              Run analysis
            </Button>
          </PageHeaderActions>
        </PageHeader>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">

          {/* Analysis Pipeline Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <IconBox icon={ScanSearch} color="primary" size="sm" />
              <CardTitle>Analysis pipeline</CardTitle>
            </div>

            <CardContent className="mt-4 space-y-3 p-0">
              <ol className="space-y-3 text-sm text-muted-foreground">
                {analysisSteps.map((step, index) => (
                  <li key={step} className="rounded-xl border border-border/70 bg-background p-3">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Latest Run Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <IconBox icon={Sparkles} color="primary" size="sm" />
              <CardTitle>Latest run</CardTitle>
            </div>

            <CardContent className="mt-4 p-0">
              <div className="rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                No manual run has been started yet for repository {repoId}.
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </main>
  );
}
