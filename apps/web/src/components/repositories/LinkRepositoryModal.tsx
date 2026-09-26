import { AnimatePresence, motion } from "framer-motion";
import { Check, Code2, Loader2, Search, X, CheckSquare, Square } from "lucide-react";
import { useEffect, useState } from "react";

import { useOrg } from "../../contexts/OrgContext";
import { api } from "../../lib/apiClient";
import { Button } from "../ui";

/*
 * =========================================================
 * LINK REPOSITORY MODAL (D-07 & D-21)
 * =========================================================
 */

interface AvailableRepo {
  githubRepoId: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  language: string | null;
  private: boolean;
  isAlreadyLinked?: boolean;
}

type BulkLinkResultStatus =
  | "LINKED"
  | "ALREADY_LINKED"
  | "NO_ADMIN"
  | "NOT_IN_ORG"
  | "NOT_FOUND"
  | "NO_CREDENTIAL"
  | "CREDENTIAL_DECRYPT_FAILED"
  | "GITHUB_ERROR";

// what the user sees instead of the raw status string
const STATUS_LABEL: Record<BulkLinkResultStatus, string> = {
  LINKED: "Linked",
  ALREADY_LINKED: "Already linked",
  NO_ADMIN: "Needs admin access on GitHub",
  NOT_IN_ORG: "Not in this organization",
  NOT_FOUND: "Not found on GitHub",
  NO_CREDENTIAL: "Sign in to GitHub again",
  CREDENTIAL_DECRYPT_FAILED: "Server could not read your GitHub token",
  GITHUB_ERROR: "GitHub error",
};

// everything that isn't a success counts as an error in the summary tile
function errorCount(summary: Record<BulkLinkResultStatus, number>): number {
  return (Object.keys(STATUS_LABEL) as BulkLinkResultStatus[])
    .filter((s) => s !== "LINKED" && s !== "ALREADY_LINKED" && s !== "NO_ADMIN")
    .reduce((total, s) => total + (summary[s] ?? 0), 0);
}

interface BulkLinkStatus {
  jobId: string;
  state: string;
  progress: { done: number; total: number };
  results?: {
    githubRepoId: number;
    status: BulkLinkResultStatus;
    fullName?: string;
    message?: string;
  }[];
  summary?: Record<BulkLinkResultStatus, number>;
  failedReason?: string;
}

interface LinkRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepoLinked: () => void;
}

export function LinkRepositoryModal({
  isOpen,
  onClose,
  onRepoLinked,
}: LinkRepositoryModalProps) {
  const { selectedOrg } = useOrg();

  const [search, setSearch] = useState("");
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk linking state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<BulkLinkStatus | null>(null);

  useEffect(() => {
    if (!isOpen || !selectedOrg) return;

    const fetchAvailable = async () => {
      setIsLoading(true);
      setError(null);
      setBulkJobId(null);
      setBulkStatus(null);
      setSelectedIds(new Set());
      try {
        const res = await api.get<{ data: AvailableRepo[] }>(
          `/api/repos/available?orgId=${selectedOrg.id}`
        );
        setAvailableRepos(res.data || []);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || "Failed to fetch available repositories."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailable();
  }, [isOpen, selectedOrg]);

  // Polling bulk status
  useEffect(() => {
    if (!bulkJobId || !selectedOrg) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get<BulkLinkStatus>(
          `/api/orgs/${selectedOrg.id}/repos/bulk-link/${bulkJobId}`
        );
        setBulkStatus(res);

        if (res.state === "completed" || res.state === "failed") {
          clearInterval(interval);
          onRepoLinked();
        }
      } catch (err) {
        console.error("Failed to poll bulk status", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [bulkJobId, selectedOrg, onRepoLinked]);

  const handleBulkLink = async () => {
    if (selectedIds.size === 0 || !selectedOrg) return;

    setError(null);
    try {
      const res = await api.post<{ jobId: string; total: number }>(
        `/api/orgs/${selectedOrg.id}/repos/bulk-link`,
        {
          githubRepoIds: Array.from(selectedIds),
        }
      );
      setBulkJobId(res.jobId);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Failed to start bulk link job."
      );
    }
  };

  const toggleSelection = (repoId: string) => {
    const next = new Set(selectedIds);
    if (next.has(repoId)) next.delete(repoId);
    else next.add(repoId);
    setSelectedIds(next);
  };

  if (!isOpen) return null;

  const filtered = availableRepos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const linkable = filtered.filter((r) => !r.isAlreadyLinked);
  const allSelected =
    linkable.length > 0 && selectedIds.size === linkable.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(linkable.map((r) => r.githubRepoId)));
    }
  };

  const isLinking = bulkJobId !== null && bulkStatus?.state !== "completed" && bulkStatus?.state !== "failed";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-bold">Link Repository</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select repositories from {selectedOrg?.name || selectedOrg?.login}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLinking}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {!bulkJobId ? (
            <>
              {/* Search */}
              <div className="p-4 border-b border-border/60">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <Search size={16} className="text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search available repositories..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {error}
                  </div>
                )}

                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
                    <Loader2 size={18} className="animate-spin text-primary" />
                    Fetching available repositories…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No available repositories found for this organization.
                  </div>
                ) : (
                  <>
                    {linkable.length > 0 && (
                      <div className="flex items-center justify-between px-2 pb-2">
                        <button
                          type="button"
                          onClick={toggleAll}
                          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          Select All
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {selectedIds.size} selected
                        </span>
                      </div>
                    )}
                    {filtered.map((repo) => (
                      <div
                        key={repo.githubRepoId}
                        onClick={() => {
                          if (!repo.isAlreadyLinked) toggleSelection(repo.githubRepoId);
                        }}
                        className={`flex items-center justify-between rounded-xl border border-border/70 bg-background p-3.5 transition ${
                          repo.isAlreadyLinked
                            ? "opacity-60 cursor-default"
                            : "cursor-pointer hover:border-primary/40"
                        } ${selectedIds.has(repo.githubRepoId) ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!repo.isAlreadyLinked) toggleSelection(repo.githubRepoId);
                            }}
                            className={`text-muted-foreground ${
                              repo.isAlreadyLinked ? "invisible" : ""
                            }`}
                          >
                            {selectedIds.has(repo.githubRepoId) ? (
                              <CheckSquare size={18} className="text-primary" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Code2 size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{repo.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {repo.fullName} • {repo.language || "Unknown"}
                            </p>
                          </div>
                        </div>

                        {repo.isAlreadyLinked && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2.5 py-1 text-xs font-semibold text-success shrink-0">
                            <Check size={13} /> Linked
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border p-4 flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBulkLink}
                  disabled={selectedIds.size === 0}
                >
                  Link {selectedIds.size} {selectedIds.size === 1 ? "repository" : "repositories"}
                </Button>
              </div>
            </>
          ) : (
            /* Bulk Link Progress State */
            <div className="flex-1 flex flex-col p-6">
              <div className="flex flex-col items-center justify-center py-6 text-center">
                {isLinking ? (
                  <Loader2 size={48} className="animate-spin text-primary mb-4" />
                ) : (
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
                    <Check size={32} />
                  </div>
                )}
                <h3 className="text-lg font-bold">
                  {isLinking ? "Linking Repositories..." : "Bulk Link Complete"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  {isLinking
                    ? "Please wait while we register webhooks and sync repository information."
                    : "The bulk linking process has finished."}
                </p>
              </div>

              <div className="mt-2 bg-muted/30 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Progress</span>
                  <span className="text-muted-foreground">
                    {bulkStatus?.progress.done || 0} / {bulkStatus?.progress.total || selectedIds.size}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        ((bulkStatus?.progress.done || 0) /
                          (bulkStatus?.progress.total || selectedIds.size || 1)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {bulkStatus?.summary && (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-success/10 text-success rounded-lg p-3">
                    <div className="text-xl font-bold">{bulkStatus.summary.LINKED}</div>
                    <div className="text-xs mt-1 font-medium">Linked</div>
                  </div>
                  <div className="bg-info/10 text-info rounded-lg p-3">
                    <div className="text-xl font-bold">{bulkStatus.summary.ALREADY_LINKED}</div>
                    <div className="text-xs mt-1 font-medium">Already Linked</div>
                  </div>
                  <div className="bg-warning/10 text-warning rounded-lg p-3">
                    <div className="text-xl font-bold">{bulkStatus.summary.NO_ADMIN}</div>
                    <div className="text-xs mt-1 font-medium">No Admin</div>
                  </div>
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3">
                    <div className="text-xl font-bold">{errorCount(bulkStatus.summary)}</div>
                    <div className="text-xs mt-1 font-medium">Errors</div>
                  </div>
                </div>
              )}

              {/* Per-repo error list if finished and there are errors */}
              {!isLinking && bulkStatus?.results && (
                <div className="mt-6 max-h-32 overflow-y-auto space-y-2 border-t border-border/50 pt-4">
                  {bulkStatus.results.map((result) => {
                    if (result.status === "LINKED" || result.status === "ALREADY_LINKED") return null;
                    const id = String(result.githubRepoId);
                    const repo = availableRepos.find((r) => r.githubRepoId === id);
                    return (
                      <div key={id} className="text-xs text-destructive p-2 bg-destructive/5 rounded-md">
                        <div className="flex justify-between">
                          <span className="font-semibold truncate mr-2">
                            {result.fullName || repo?.fullName || id}
                          </span>
                          <span className="shrink-0">{STATUS_LABEL[result.status]}</span>
                        </div>
                        {result.message && <div className="mt-1 opacity-80">{result.message}</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isLinking && (
                <div className="mt-6 flex justify-end">
                  <Button variant="primary" onClick={onClose} className="w-full">
                    Done
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
