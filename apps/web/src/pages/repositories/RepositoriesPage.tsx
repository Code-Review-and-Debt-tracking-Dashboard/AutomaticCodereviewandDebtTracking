import { motion } from "framer-motion";
import {
  Code2,
  ExternalLink,
  Filter,
  GitBranch,
  GitFork,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  X,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useOrg } from "../../contexts/OrgContext";
import { api } from "../../lib/apiClient";
import { LinkRepositoryModal } from "../../components/repositories/LinkRepositoryModal";

import {
  Button,
  Card,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  StatCard,
  Select,
} from "../../components/ui";

/*
 * =========================================================
 * REPOSITORIES PAGE (D-06)
 * =========================================================
 */

type RepositoryStatus = "Excellent" | "Healthy" | "Needs attention";

interface ApiRepository {
  id: string;
  githubRepoId?: string;
  name: string;
  fullName: string;
  language: string | null;
  defaultBranch: string;
  isActive: boolean;
  orgId: string;
  healthScore?: number;
  openFindings?: number;
  debtMinutes?: number;
  lastAnalyzedAt?: string | null;
  private?: boolean;
}

type Repository = {
  id: string;
  name: string;
  fullName: string;
  language: string;
  score: number;
  findings: number;
  debt: string;
  status: RepositoryStatus;
  branch: string;
  lastAnalyzed: string;
  isPrivate: boolean;
};

const languages = [
  "All languages",
  "TypeScript",
  "Python",
  "Java",
  "JavaScript",
  "C++",
];

const scoreFilters = [
  "All scores",
  "Excellent (85+)",
  "Healthy (70-84)",
  "Needs attention (<70)",
];

type SortOption = "health" | "findings" | "debt" | "recent";

export function RepositoriesPage() {
  const navigate = useNavigate();
  const { selectedOrg } = useOrg();

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("All languages");
  const [scoreFilter, setScoreFilter] = useState("All scores");
  const [sortBy, setSortBy] = useState<SortOption>("health");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  const fetchRepos = async () => {
    if (!selectedOrg) {
      setRepositories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ApiRepository[] }>(
        `/api/orgs/${selectedOrg.id}/repos`
      );
      const apiList = res.data || [];

      // Map backend schema to UI Repository shape
      const mapped: Repository[] = apiList.map((item) => {
        const score = item.healthScore ?? 80;
        let status: RepositoryStatus = "Healthy";
        if (score >= 85) status = "Excellent";
        else if (score < 70) status = "Needs attention";

        const minutes = item.debtMinutes ?? 120;
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const debtStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

        return {
          id: item.id,
          name: item.name,
          fullName: item.fullName,
          language: item.language || "TypeScript",
          score,
          findings: item.openFindings ?? 0,
          debt: debtStr,
          status,
          branch: item.defaultBranch || "main",
          lastAnalyzed: item.lastAnalyzedAt
            ? new Date(item.lastAnalyzedAt).toLocaleDateString()
            : "Recently",
          isPrivate: item.private ?? false,
        };
      });

      setRepositories(mapped);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Failed to load repositories for this organization."
      );
      setRepositories([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [selectedOrg?.id, fetchRepos]);

  const filteredRepositories = useMemo(() => {
    let result = [...repositories];

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (repo) =>
          repo.name.toLowerCase().includes(query) ||
          repo.fullName.toLowerCase().includes(query)
      );
    }

    if (language !== "All languages") {
      result = result.filter((repo) => repo.language === language);
    }

    if (scoreFilter === "Excellent (85+)") {
      result = result.filter((repo) => repo.score >= 85);
    } else if (scoreFilter === "Healthy (70-84)") {
      result = result.filter((repo) => repo.score >= 70 && repo.score < 85);
    } else if (scoreFilter === "Needs attention (<70)") {
      result = result.filter((repo) => repo.score < 70);
    }

    result.sort((a, b) => {
      if (sortBy === "health") return b.score - a.score;
      if (sortBy === "findings") return b.findings - a.findings;
      if (sortBy === "debt") return b.debt.localeCompare(a.debt);
      return 0;
    });

    return result;
  }, [repositories, search, language, scoreFilter, sortBy]);

  const stats = useMemo(() => {
    const total = repositories.length;
    const avgHealth =
      total > 0
        ? (repositories.reduce((acc, r) => acc + r.score, 0) / total).toFixed(1)
        : "0.0";
    const healthyCount = repositories.filter((r) => r.score >= 70).length;
    const totalFindings = repositories.reduce((acc, r) => acc + r.findings, 0);

    return {
      total,
      avgHealth,
      healthyCount,
      totalFindings,
    };
  }, [repositories]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        
        <PageHeader>
          <div>
            <PageHeaderBadge className="border-primary/20 bg-primary/10 text-primary">
              <GitBranch size={13} />
              Organization: {selectedOrg?.name || selectedOrg?.login || "Select Org"}
            </PageHeaderBadge>

            <PageHeaderTitle>Repositories</PageHeaderTitle>

            <PageHeaderDescription>
              Monitor code health and technical debt for repositories in this organization.
            </PageHeaderDescription>
          </div>

          <PageHeaderActions>
            <Button
              onClick={() => setIsLinkModalOpen(true)}
              variant="primary"
            >
              <Plus size={17} className="mr-2" />
              Add repository
            </Button>
          </PageHeaderActions>
        </PageHeader>

        {/* SUMMARY CARDS */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Code2}
            title="Total repositories"
            value={String(stats.total)}
            color="primary"
          />

          <StatCard
            icon={TrendingUp}
            title="Average health"
            value={String(stats.avgHealth)}
            color="success"
          />

          <StatCard
            icon={ShieldCheck}
            title="Healthy repositories"
            value={String(stats.healthyCount)}
            color="info"
          />

          <StatCard
            icon={GitFork}
            title="Total findings"
            value={String(stats.totalFindings)}
            color="warning"
          />
        </div>

        {/* SEARCH & FILTERS */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 rounded-2xl border border-border/70 bg-card p-4 sm:p-5"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2.5 transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
              <Search size={17} className="shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="text"
                placeholder="Search repositories..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <Button
              onClick={() => setFiltersOpen((prev) => !prev)}
              variant="outline"
              className="lg:hidden"
            >
              <Filter size={16} className="mr-2" />
              Filters
            </Button>

            <div className="hidden items-center gap-3 lg:flex">
              <Select
                value={language}
                onChange={setLanguage}
                options={languages}
              />

              <Select
                value={scoreFilter}
                onChange={setScoreFilter}
                options={scoreFilters}
              />

              <Select
                value={sortBy}
                onChange={(val) => setSortBy(val as SortOption)}
                options={["health", "findings", "debt", "recent"]}
              />
            </div>
          </div>

          {filtersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3 lg:hidden"
            >
              <Select
                value={language}
                onChange={setLanguage}
                options={languages}
              />

              <Select
                value={scoreFilter}
                onChange={setScoreFilter}
                options={scoreFilters}
              />

              <Select
                value={sortBy}
                onChange={(val) => setSortBy(val as SortOption)}
                options={["health", "findings", "debt", "recent"]}
              />
            </motion.div>
          )}
        </motion.section>

        {/* RESULTS HEADER */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Your repositories</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {filteredRepositories.length} repositories found
            </p>
          </div>

          <button
            type="button"
            className="hidden items-center gap-2 text-xs font-medium text-muted-foreground transition hover:text-primary sm:flex"
          >
            <SlidersHorizontal size={14} />
            Customize view
          </button>
        </div>

        {/* CONTENT STATES */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm">Loading repositories from Postgres…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center text-destructive">
            <p className="text-sm font-semibold">{error}</p>
            <Button
              onClick={fetchRepos}
              variant="destructive"
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        ) : filteredRepositories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Search size={32} className="mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-sm font-semibold">No repositories found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No repositories match your current search or organization selection.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredRepositories.map((repository, index) => (
              <RepositoryCard
                key={repository.id}
                repository={repository}
                index={index}
                onSelect={() => navigate(`/repositories/${repository.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <LinkRepositoryModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onRepoLinked={fetchRepos}
      />
    </main>
  );
}

function RepositoryCard({
  repository,
  index,
  onSelect,
}: {
  repository: Repository;
  index: number;
  onSelect: () => void;
}) {
  const isHealthy = repository.score >= 85;

  return (
    <Card
      className="group cursor-pointer transition hover:border-primary/30 hover:shadow-xl sm:p-2"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Code2 size={21} />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{repository.name}</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {repository.fullName}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Health
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                isHealthy ? "text-success" : "text-warning"
              }`}
            >
              {repository.score}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Findings
            </p>
            <p className="mt-1 text-2xl font-bold">{repository.findings}</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Debt
            </p>
            <p className="mt-1 text-lg font-bold">{repository.debt}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Health score</span>
            <span className="text-xs font-medium text-success">
              {repository.score >= 85 ? "Excellent" : "Needs improvement"}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${repository.score}%` }}
              transition={{ duration: 0.8, delay: index * 0.05 }}
              className={`h-full rounded-full ${
                isHealthy ? "bg-success" : "bg-warning"
              }`}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {repository.language}
            </span>
            <span className="text-xs text-muted-foreground">
              {repository.lastAnalyzed}
            </span>
          </div>

          <Button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            variant="outline"
            size="sm"
          >
            View repository
            <ExternalLink size={14} className="ml-2" />
          </Button>
        </div>
      </div>
    </Card>
  );
}