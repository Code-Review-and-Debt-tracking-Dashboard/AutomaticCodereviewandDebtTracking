import { useEffect, useState } from "react";
import { ScanSearch, PlayCircle, Sparkles } from "lucide-react";
import { useParams } from "react-router-dom";

import { api } from "../../lib/apiClient";

import {
  BackLink,
  Card,
  CardTitle,
  CardContent,
  Button,
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

  const [repoInfo, setRepoInfo] = useState<{
    name: string;
    defaultBranch?: string;
    lastAnalyzedAt?: string | null;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;

    const loadRepo = async () => {
      try {
        const repoData = await api.get<any>(`/repos/${repoId}`);
        setRepoInfo(repoData);
      } catch (error) {
        console.error("Failed to load repo info", error);
      }
    };

    loadRepo();
  }, [repoId]);

  const handleRunAnalysis = async () => {
    if (!repoId) return;
    setIsRunning(true);
    setSuccessMessage(null);
    setRunError(null);
    try {
      const result = await api.post<any>(`/repos/${repoId}/analyze`);
      setSuccessMessage(result?.message || "Analysis queued");
    } catch (error: any) {
      setRunError(error?.response?.data?.error?.message || "Failed to start analysis.");
    } finally {
      setIsRunning(false);
    }
  };

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
            <Button onClick={handleRunAnalysis} disabled={isRunning}>
              <PlayCircle size={16} />
              {isRunning ? "Running…" : "Run analysis"}
            </Button>
          </PageHeaderActions>
        </PageHeader>

        {successMessage && (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
            {successMessage}
          </div>
        )}

        {runError && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {runError}
          </div>
        )}

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
                {repoInfo?.lastAnalyzedAt ? (
                  <p>
                    Last analyzed on branch: {repoInfo.defaultBranch || "main"} &mdash;{" "}
                    {new Date(repoInfo.lastAnalyzedAt).toLocaleDateString()}
                  </p>
                ) : (
                  <p>No manual run has been started yet for repository {repoId}.</p>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </main>
  );
}
