import {
  CheckCircle2,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../../lib/apiClient";

import {
  BackLink,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  IconBox,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
} from "../../components/ui";


/* =========================================================
   TYPES
========================================================= */

interface QualityGate {
  repoId: string;
  minHealthScore: number;
  maxCriticalFindings: number | null;
  maxVulnerabilities: number | null;
  maxDuplicationPct: number | null;
  maxComplexityCount: number | null;
  maxCodeSmellCount: number | null;
  blockPR: boolean;
}

interface GateHistoryItem {
  id: number;
  score: number;
  status: string;
  time: string;
}


/* =========================================================
   COMPONENT
========================================================= */

export function RepositoryQualityGatePage() {
  const { repoId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<QualityGate>({
    repoId: repoId || "",
    minHealthScore: 60,
    maxCriticalFindings: null,
    maxVulnerabilities: null,
    maxDuplicationPct: null,
    maxComplexityCount: null,
    maxCodeSmellCount: null,
    blockPR: false,
  });
  const [history, setHistory] = useState<GateHistoryItem[]>([]);

  useEffect(() => {
    if (!repoId) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      const [gateResult, pullsResult] = await Promise.allSettled([
        api.get<{ data: QualityGate }>(`/api/repos/${repoId}/quality-gate`),
        api.get<{ data: GateHistoryItem[] }>(`/api/repos/${repoId}/pulls`),
      ]);

      if (gateResult.status === "fulfilled") {
        setGate(gateResult.value.data);
      } else {
        setError(
          gateResult.reason?.response?.data?.error?.message || "Failed to load quality gate.",
        );
      }

      if (pullsResult.status === "fulfilled") {
        setHistory(pullsResult.value.data);
      }

      setIsLoading(false);
    };

    loadData();
  }, [repoId]);

  const updateGate = <K extends keyof QualityGate>(key: K, value: QualityGate[K]) => {
    setGate((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
  };

  const handleSave = async () => {
    if (!repoId) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await api.put<{ data: QualityGate }>(`/api/repos/${repoId}/quality-gate`, gate);
      setGate(response.data);
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error?.message || "Failed to save quality gate.");
    } finally {
      setIsSaving(false);
    }
  };

  const displayGate = gate;
  const latest = history[0];
  const scoreGlyph = (score: number) => (score >= displayGate.minHealthScore ? "≥" : "<");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderBadge className="border-success/20 bg-success/10 text-success">
              <ShieldCheck size={13} />
              Automated quality control
            </PageHeaderBadge>

            <PageHeaderTitle>Quality Gate</PageHeaderTitle>

            <PageHeaderDescription>
              Define the conditions that code must satisfy before it can be
              merged.
            </PageHeaderDescription>
          </div>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">

          {/* Rules Card */}
          <Card>
            <CardHeader className="border-b border-border/70">
              <div>
                <CardTitle>Quality Gate Rules</CardTitle>
                <CardDescription>
                  Configure repository quality requirements.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-6 pt-1">

                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {isLoading ? (
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Loading quality gate…
                  </div>
                ) : null}

                <div>
                  <label className="text-sm font-medium">
                    Minimum Health Score
                  </label>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Pull requests below this score will fail the quality gate.
                  </p>

                  <div className="mt-3 flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={displayGate.minHealthScore}
                      onChange={(event) =>
                        updateGate("minHealthScore", Number(event.target.value))
                      }
                      className="h-2 w-full accent-primary"
                    />

                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={displayGate.minHealthScore}
                      onChange={(event) => {
                        const next = Math.min(100, Math.max(0, Number(event.target.value)));
                        updateGate("minHealthScore", next);
                      }}
                      className="h-11 w-20 shrink-0 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Maximum Critical Findings
                    </label>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={displayGate.maxCriticalFindings === null}
                        onChange={(event) =>
                          updateGate("maxCriticalFindings", event.target.checked ? null : 0)
                        }
                      />
                      No limit
                    </label>
                  </div>

                  <input
                    type="number"
                    min={0}
                    disabled={displayGate.maxCriticalFindings === null}
                    value={displayGate.maxCriticalFindings ?? ""}
                    onChange={(event) =>
                      updateGate("maxCriticalFindings", Math.max(0, Number(event.target.value)))
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Maximum Vulnerabilities
                    </label>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={displayGate.maxVulnerabilities === null}
                        onChange={(event) =>
                          updateGate("maxVulnerabilities", event.target.checked ? null : 0)
                        }
                      />
                      No limit
                    </label>
                  </div>

                  <input
                    type="number"
                    min={0}
                    disabled={displayGate.maxVulnerabilities === null}
                    value={displayGate.maxVulnerabilities ?? ""}
                    onChange={(event) =>
                      updateGate("maxVulnerabilities", Math.max(0, Number(event.target.value)))
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Maximum Duplication %
                    </label>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={displayGate.maxDuplicationPct === null}
                        onChange={(event) =>
                          updateGate("maxDuplicationPct", event.target.checked ? null : 0)
                        }
                      />
                      No limit
                    </label>
                  </div>

                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={displayGate.maxDuplicationPct === null}
                    value={displayGate.maxDuplicationPct ?? ""}
                    onChange={(event) =>
                      updateGate(
                        "maxDuplicationPct",
                        Math.min(100, Math.max(0, Number(event.target.value))),
                      )
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Maximum Complexity Count
                    </label>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={displayGate.maxComplexityCount === null}
                        onChange={(event) =>
                          updateGate("maxComplexityCount", event.target.checked ? null : 0)
                        }
                      />
                      No limit
                    </label>
                  </div>

                  <input
                    type="number"
                    min={0}
                    disabled={displayGate.maxComplexityCount === null}
                    value={displayGate.maxComplexityCount ?? ""}
                    onChange={(event) =>
                      updateGate("maxComplexityCount", Math.max(0, Number(event.target.value)))
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Maximum Code Smell Count
                    </label>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={displayGate.maxCodeSmellCount === null}
                        onChange={(event) =>
                          updateGate("maxCodeSmellCount", event.target.checked ? null : 0)
                        }
                      />
                      No limit
                    </label>
                  </div>

                  <input
                    type="number"
                    min={0}
                    disabled={displayGate.maxCodeSmellCount === null}
                    value={displayGate.maxCodeSmellCount ?? ""}
                    onChange={(event) =>
                      updateGate("maxCodeSmellCount", Math.max(0, Number(event.target.value)))
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>

                <div className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Block PRs that fail this gate
                    </span>

                    <button
                      onClick={() => updateGate("blockPR", !displayGate.blockPR)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        displayGate.blockPR ? "bg-success" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                          displayGate.blockPR ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Posts a failing commit status on GitHub when the gate fails.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || isLoading}
                    size="lg"
                  >
                    <Save size={17} />
                    {isSaving ? "Saving…" : "Save Quality Gate"}
                  </Button>

                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={isSaving || isLoading}
                    onClick={() =>
                      setGate({
                        repoId: repoId || "",
                        minHealthScore: 60,
                        maxCriticalFindings: null,
                        maxVulnerabilities: null,
                        maxDuplicationPct: null,
                        maxComplexityCount: null,
                        maxCodeSmellCount: null,
                        blockPR: false,
                      })
                    }
                  >
                    <RotateCcw size={17} />
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Current Status Card */}
          <Card className="p-5 sm:p-6">
            <IconBox icon={CheckCircle2} color="success" size="lg" />

            <p className="mt-5 text-lg font-semibold">
              Current Status
            </p>

            {latest ? (
              <>
                <div className="mt-2">
                  <Badge
                    variant="muted"
                    className={
                      latest.status === "Passed"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }
                  >
                    {latest.status === "Passed" ? (
                      <CheckCircle2 size={13} className="mr-1.5" />
                    ) : (
                      <ShieldAlert size={13} className="mr-1.5" />
                    )}
                    {latest.status === "Passed" ? "Passing" : "Failing"}
                  </Badge>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  Score {latest.score} {scoreGlyph(latest.score)} {displayGate.minHealthScore}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Last evaluated: PR #{latest.id} · {latest.time}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Not evaluated yet — no pull requests analyzed.
              </p>
            )}

            <p className="mt-4 text-sm text-muted-foreground">
              {displayGate.blockPR
                ? "Pull requests are blocked when the gate fails."
                : "Pull requests are not blocked by the gate yet."}
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-sm">
                  Minimum score
                </span>

                <span className="font-semibold">
                  {displayGate.minHealthScore}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-sm">
                  Critical findings
                </span>

                <span className="font-semibold">
                  {displayGate.maxCriticalFindings === null ? "No limit" : `≤ ${displayGate.maxCriticalFindings}`}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-sm">
                  Vulnerabilities
                </span>

                <span className="font-semibold">
                  {displayGate.maxVulnerabilities === null ? "No limit" : `≤ ${displayGate.maxVulnerabilities}`}
                </span>
              </div>
            </div>
          </Card>

        </div>

        <Card className="mt-6 p-5 sm:p-6">
          <div className="mb-4">
            <p className="text-sm font-semibold">Gate History</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Recent pull request evaluations.
            </p>
          </div>

          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No pull requests analyzed yet.
            </p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-3"
                >
                  <span className="text-sm font-medium">PR #{item.id}</span>

                  <Badge
                    variant="muted"
                    className={
                      item.status === "Passed"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }
                  >
                    {item.status === "Passed" ? (
                      <CheckCircle2 size={13} className="mr-1.5" />
                    ) : (
                      <ShieldAlert size={13} className="mr-1.5" />
                    )}
                    {item.status}
                  </Badge>

                  <span className="text-xs text-muted-foreground">
                    Score {item.score} {scoreGlyph(item.score)} {displayGate.minHealthScore}
                  </span>

                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
