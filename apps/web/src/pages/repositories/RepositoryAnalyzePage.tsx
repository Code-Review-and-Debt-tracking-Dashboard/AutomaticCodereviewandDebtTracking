import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import {
  HealthIcon,
} from "../../components/icons";
import { Link, useParams } from "react-router-dom";

import { api } from "../../lib/apiClient";
import { apiErrorMessage } from "../../lib/apiError";

import {
  BackLink,
  Badge,
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


const analysisSteps = [
  "Clone repository into the worker sandbox",
  "Run analyzers and normalize findings",
  "Persist HealthSnapshot and return the result",
];

type AnalysisRun = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  trigger: string;
  branch: string;
  commitSha: string;
  errorMessage: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

const statusBadge = {
  PENDING: { label: "Queued", variant: "warning" },
  RUNNING: { label: "Running", variant: "info" },
  COMPLETED: { label: "Completed", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "muted" },
} as const;

// how often to re-check while a run is queued or running
const POLL_MS = 3000;

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "—";
}


export function RepositoryAnalyzePage() {
  const { repoId } = useParams();

  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const latest = runs[0];
  const inProgress = latest?.status === "PENDING" || latest?.status === "RUNNING";

  const loadRuns = async () => {
    try {
      const result = await api.get<{ data: AnalysisRun[] }>(`/api/repos/${repoId}/analyses`);
      setRuns(result.data);
      setLoadError(null);
    } catch (error) {
      setLoadError(apiErrorMessage(error, "Failed to load analysis runs."));
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    if (repoId) loadRuns();
  }, [repoId]);

  // keep checking until the latest run finishes
  useEffect(() => {
    if (!inProgress) return;
    const timer = setTimeout(loadRuns, POLL_MS);
    return () => clearTimeout(timer);
  }, [runs]);

  const handleRunAnalysis = async () => {
    if (!repoId) return;
    setIsRunning(true);
    setSuccessMessage(null);
    setRunError(null);
    try {
      const result = await api.post<any>(`/api/repos/${repoId}/analyze`);
      setSuccessMessage(result?.message || "Analysis queued");
      await loadRuns();
    } catch (error: any) {
      setRunError(error?.response?.data?.error?.message || "Failed to start analysis.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>

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
          <Button onClick={handleRunAnalysis} disabled={isRunning || inProgress}>
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
            <IconBox icon={HealthIcon} color="primary" size="sm" />
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
            <IconBox icon={HealthIcon} color="primary" size="sm" />
            <CardTitle>Latest run</CardTitle>
          </div>

          <CardContent className="mt-4 space-y-3 p-0">
            {!isLoaded ? (
              <div className="rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                Loading analysis runs…
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {loadError}
              </div>
            ) : latest ? (
              <div className="space-y-2 rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant={statusBadge[latest.status].variant} dot>
                    {statusBadge[latest.status].label}
                  </Badge>
                  <span>
                    {latest.trigger.toLowerCase()} run on {latest.branch} @ {latest.commitSha.slice(0, 7)}
                  </span>
                </div>
                <p>Queued: {formatTime(latest.queuedAt)}</p>
                <p>Started: {formatTime(latest.startedAt)}</p>
                <p>Finished: {formatTime(latest.completedAt)}</p>
                {latest.errorMessage && (
                  <p className="text-destructive">Error: {latest.errorMessage}</p>
                )}
                {latest.status === "COMPLETED" && (
                  <Link
                    to={`/repositories/${repoId}`}
                    className="inline-block pt-1 font-medium text-primary hover:underline"
                  >
                    View results
                  </Link>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                No analysis has run yet for this repository.
              </div>
            )}

            {runs.length > 1 && (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {runs.slice(1).map((run) => (
                  <li key={run.id} className="flex items-center gap-2">
                    <Badge variant={statusBadge[run.status].variant} size="sm">
                      {statusBadge[run.status].label}
                    </Badge>
                    {run.trigger.toLowerCase()} &middot; {formatTime(run.queuedAt)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

      </div>
    </>
  );
}
