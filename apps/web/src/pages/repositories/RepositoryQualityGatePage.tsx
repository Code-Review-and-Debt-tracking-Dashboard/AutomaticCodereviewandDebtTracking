import {
  CheckCircle2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../../lib/apiClient";

import {
  BackLink,
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


/* =========================================================
   COMPONENT
========================================================= */

export function RepositoryQualityGatePage() {
  const { repoId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<QualityGate | null>(null);

  useEffect(() => {
    const fetchGate = async () => {
      if (!repoId) return;

      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<{ data: QualityGate }>(`/api/repos/${repoId}/quality-gate`);
        setGate(response.data);
      } catch (fetchError: any) {
        setError(fetchError?.response?.data?.error?.message || "Failed to load quality gate.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGate();
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
    if (!repoId || !gate) return;

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

  const displayGate = gate ?? {
    repoId: repoId || "",
    minHealthScore: 60,
    maxCriticalFindings: null,
    maxVulnerabilities: null,
    maxDuplicationPct: null,
    maxComplexityCount: null,
    maxCodeSmellCount: null,
    blockPR: false,
  };

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

                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={displayGate.minHealthScore}
                    onChange={(event) =>
                      updateGate("minHealthScore", Number(event.target.value))
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Maximum Critical Findings
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={displayGate.maxCriticalFindings ?? ""}
                    onChange={(event) =>
                      updateGate(
                        "maxCriticalFindings",
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Maximum Vulnerabilities
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={displayGate.maxVulnerabilities ?? ""}
                    onChange={(event) =>
                      updateGate(
                        "maxVulnerabilities",
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Maximum Duplication %
                  </label>

                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={displayGate.maxDuplicationPct ?? ""}
                    onChange={(event) =>
                      updateGate(
                        "maxDuplicationPct",
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Maximum Complexity Count
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={displayGate.maxComplexityCount ?? ""}
                    onChange={(event) =>
                      updateGate(
                        "maxComplexityCount",
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Maximum Code Smell Count
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={displayGate.maxCodeSmellCount ?? ""}
                    onChange={(event) =>
                      updateGate(
                        "maxCodeSmellCount",
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  size="lg"
                >
                  <Save size={17} />
                  {isSaving ? "Saving…" : "Save Quality Gate"}
                </Button>
              </div>
            </CardContent>
          </Card>


          {/* Current Status Card */}
          <Card className="p-5 sm:p-6">
            <IconBox icon={CheckCircle2} color="success" size="lg" />

            <p className="mt-5 text-lg font-semibold">
              Current Status
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
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
                  {displayGate.maxCriticalFindings === null ? "Any" : `≤ ${displayGate.maxCriticalFindings}`}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-sm">
                  Vulnerabilities
                </span>

                <span className="font-semibold">
                  {displayGate.maxVulnerabilities === null ? "Any" : `≤ ${displayGate.maxVulnerabilities}`}
                </span>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </main>
  );
}