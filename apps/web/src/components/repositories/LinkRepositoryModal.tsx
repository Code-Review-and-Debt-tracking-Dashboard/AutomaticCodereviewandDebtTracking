import { AnimatePresence, motion } from "framer-motion";
import { Check, Code2, Loader2, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useOrg } from "../../contexts/OrgContext";
import { api } from "../../lib/apiClient";

/*
 * =========================================================
 * LINK REPOSITORY MODAL (D-07)
 * =========================================================
 *
 * Modal that lists user's available GitHub repositories via Octokit
 * filtered to the selected organization (GET /api/repos/available).
 * Linking a repo calls POST /api/repos.
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
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !selectedOrg) return;

    const fetchAvailable = async () => {
      setIsLoading(true);
      setError(null);
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

  const handleLink = async (repo: AvailableRepo) => {
    setLinkingId(repo.githubRepoId);
    setError(null);
    try {
      // Everything else comes from GitHub, and the org is derived from the
      // repo's owner, so sending more than the id would just be ignored.
      await api.post("/api/repos", {
        githubRepoId: Number(repo.githubRepoId),
      });

      onRepoLinked();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Failed to link repository."
      );
    } finally {
      setLinkingId(null);
    }
  };

  if (!isOpen) return null;

  const filtered = availableRepos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase())
  );

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
                Select a GitHub repository from {selectedOrg?.name || selectedOrg?.login}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X size={18} />
            </button>
          </div>

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
              filtered.map((repo) => (
                <div
                  key={repo.githubRepoId}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background p-3.5 transition hover:border-primary/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
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

                  {repo.isAlreadyLinked ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2.5 py-1 text-xs font-semibold text-success shrink-0">
                      <Check size={13} /> Linked
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLink(repo)}
                      disabled={linkingId === repo.githubRepoId}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50 shrink-0"
                    >
                      {linkingId === repo.githubRepoId ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      Link
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
