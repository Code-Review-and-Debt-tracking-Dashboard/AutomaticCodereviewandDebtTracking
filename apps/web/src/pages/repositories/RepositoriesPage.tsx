import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
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
} from "lucide-react";
import { useMemo, useState } from "react";

/*
 * =========================================================
 * BACKEND CONNECTION LATER
 * =========================================================
 *
 * CURRENT:
 * Static mock repository data.
 *
 * FUTURE:
 *
 * GET /api/repos
 *
 * Expected backend response:
 *
 * [
 *   {
 *     id: "...",
 *     githubId: 123456,
 *     name: "AutomaticCodeReview",
 *     fullName: "owner/AutomaticCodeReview",
 *     language: "TypeScript",
 *     defaultBranch: "main",
 *     healthScore: 86,
 *     openFindings: 24,
 *     technicalDebtMinutes: 260,
 *     lastAnalyzedAt: "...",
 *     isActive: true
 *   }
 * ]
 *
 * This page will later use:
 *
 * const { data, isLoading, error } = useRepositories();
 */

type RepositoryStatus =
  | "Excellent"
  | "Healthy"
  | "Needs attention";

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

/*
 * =========================================================
 * MOCK DATA
 * =========================================================
 *
 * Replace this with:
 *
 * const { data: repositories = [] } = useRepositories();
 *
 * after the backend API is ready.
 */

const mockRepositories: Repository[] = [
  {
    id: "repo-1",
    name: "AutomaticCodeReview",
    fullName: "Code-Review/AutomaticCodeReview",
    language: "TypeScript",
    score: 86,
    findings: 24,
    debt: "4h 20m",
    status: "Healthy",
    branch: "main",
    lastAnalyzed: "8 min ago",
    isPrivate: false,
  },
  {
    id: "repo-2",
    name: "MobileDashboard",
    fullName: "Code-Review/MobileDashboard",
    language: "TypeScript",
    score: 74,
    findings: 47,
    debt: "8h 45m",
    status: "Needs attention",
    branch: "main",
    lastAnalyzed: "32 min ago",
    isPrivate: true,
  },
  {
    id: "repo-3",
    name: "AnalysisWorker",
    fullName: "Code-Review/AnalysisWorker",
    language: "Python",
    score: 91,
    findings: 12,
    debt: "2h 10m",
    status: "Excellent",
    branch: "develop",
    lastAnalyzed: "1 hour ago",
    isPrivate: false,
  },
  {
    id: "repo-4",
    name: "CodeQualityEngine",
    fullName: "Code-Review/CodeQualityEngine",
    language: "Java",
    score: 82,
    findings: 31,
    debt: "6h 05m",
    status: "Healthy",
    branch: "main",
    lastAnalyzed: "2 hours ago",
    isPrivate: false,
  },
];

/*
 * =========================================================
 * AVAILABLE FILTERS
 * =========================================================
 */

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

type SortOption =
  | "health"
  | "findings"
  | "debt"
  | "recent";

export function RepositoriesPage() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("All languages");
  const [scoreFilter, setScoreFilter] = useState("All scores");
  const [sortBy, setSortBy] = useState<SortOption>("health");
  const [filtersOpen, setFiltersOpen] = useState(false);

  /*
   * =========================================================
   * FRONTEND FILTERING
   * =========================================================
   *
   * CURRENT:
   * Filtering happens locally.
   *
   * FUTURE:
   * The backend may support:
   *
   * GET /api/repos?
   * search=...
   * &language=...
   * &sort=...
   *
   * For a small number of repositories, local filtering is fine.
   * For many repositories, move filtering to the backend.
   */

  const filteredRepositories = useMemo(() => {
    let result = [...mockRepositories];

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter(
        (repository) =>
          repository.name.toLowerCase().includes(query) ||
          repository.fullName.toLowerCase().includes(query),
      );
    }

    if (language !== "All languages") {
      result = result.filter(
        (repository) =>
          repository.language === language,
      );
    }

    if (scoreFilter === "Excellent (85+)") {
      result = result.filter(
        (repository) => repository.score >= 85,
      );
    }

    if (scoreFilter === "Healthy (70-84)") {
      result = result.filter(
        (repository) =>
          repository.score >= 70 &&
          repository.score < 85,
      );
    }

    if (scoreFilter === "Needs attention (<70)") {
      result = result.filter(
        (repository) => repository.score < 70,
      );
    }

    result.sort((a, b) => {
      if (sortBy === "health") {
        return b.score - a.score;
      }

      if (sortBy === "findings") {
        return b.findings - a.findings;
      }

      if (sortBy === "debt") {
        return b.debt.localeCompare(a.debt);
      }

      return 0;
    });

    return result;
  }, [
    search,
    language,
    scoreFilter,
    sortBy,
  ]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">

        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
        >
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <GitBranch size={13} />

              Connected repositories
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Repositories
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Monitor the health, findings, and technical debt of your repositories.
            </p>
          </div>

          {/* BACKEND CONNECTION LATER
              This button will open:

              <LinkRepositoryModal />

              Which will use:

              GET /api/github/repos

              POST /api/repos
          */}

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-primary/30"
          >
            <Plus size={17} />

            Add repository
          </button>
        </motion.div>

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <RepositorySummaryCard
            icon={Code2}
            title="Total repositories"
            value="12"
            description="+2 this month"
            iconClass="bg-primary/10 text-primary"
          />

          <RepositorySummaryCard
            icon={TrendingUp}
            title="Average health"
            value="84.6"
            description="+8.2% this week"
            iconClass="bg-success/10 text-success"
          />

          <RepositorySummaryCard
            icon={ShieldCheck}
            title="Healthy repositories"
            value="9"
            description="75% of all repositories"
            iconClass="bg-info/10 text-info"
          />

          <RepositorySummaryCard
            icon={GitFork}
            title="Total findings"
            value="183"
            description="-24 this week"
            iconClass="bg-warning/10 text-warning"
          />

        </div>

        {/* =================================================
            SEARCH + FILTERS
        ================================================= */}

        <motion.section
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.2,
          }}
          className="mb-6 rounded-2xl border border-border/70 bg-card p-4 sm:p-5"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">

            {/* SEARCH */}

            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2.5 transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
              <Search
                size={17}
                className="shrink-0 text-muted-foreground"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
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

            {/* MOBILE FILTER BUTTON */}

            <button
              type="button"
              onClick={() =>
                setFiltersOpen((value) => !value)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted lg:hidden"
            >
              <Filter size={16} />

              Filters
            </button>

            {/* DESKTOP FILTERS */}

            <div className="hidden items-center gap-3 lg:flex">

              <FilterSelect
                value={language}
                onChange={setLanguage}
                options={languages}
              />

              <FilterSelect
                value={scoreFilter}
                onChange={setScoreFilter}
                options={scoreFilters}
              />

              <FilterSelect
                value={sortBy}
                onChange={(value) =>
                  setSortBy(value as SortOption)
                }
                options={[
                  "health",
                  "findings",
                  "debt",
                  "recent",
                ]}
              />

            </div>
          </div>

          {/* MOBILE FILTERS */}

          {filtersOpen && (
            <motion.div
              initial={{
                opacity: 0,
                height: 0,
              }}
              animate={{
                opacity: 1,
                height: "auto",
              }}
              className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3 lg:hidden"
            >
              <FilterSelect
                value={language}
                onChange={setLanguage}
                options={languages}
              />

              <FilterSelect
                value={scoreFilter}
                onChange={setScoreFilter}
                options={scoreFilters}
              />

              <FilterSelect
                value={sortBy}
                onChange={(value) =>
                  setSortBy(value as SortOption)
                }
                options={[
                  "health",
                  "findings",
                  "debt",
                  "recent",
                ]}
              />
            </motion.div>
          )}
        </motion.section>

        {/* =================================================
            RESULTS HEADER
        ================================================= */}

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">
              Your repositories
            </p>

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

        {/* =================================================
            REPOSITORY GRID
        ================================================= */}

        <div className="grid gap-4 xl:grid-cols-2">

          {filteredRepositories.map(
            (repository, index) => (
              <RepositoryCard
                key={repository.id}
                repository={repository}
                index={index}
              />
            ),
          )}

        </div>

        {/* EMPTY STATE */}

        {filteredRepositories.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Search
              size={32}
              className="mx-auto text-muted-foreground"
            />

            <h3 className="mt-4 text-sm font-semibold">
              No repositories found
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Try changing your search or filters.
            </p>
          </div>
        )}

      </div>
    </main>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

type SummaryCardProps = {
  icon: React.ComponentType<{
    size?: number;
  }>;
  title: string;
  value: string;
  description: string;
  iconClass: string;
};

function RepositorySummaryCard({
  icon: Icon,
  title,
  value,
  description,
  iconClass,
}: SummaryCardProps) {
  return (
    <motion.div
      whileHover={{
        y: -4,
      }}
      className="rounded-2xl border border-border/70 bg-card p-5 transition hover:border-primary/30 hover:shadow-xl"
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
      >
        <Icon size={20} />
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        {title}
      </p>

      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight">
          {value}
        </p>

        <p className="text-xs font-medium text-success">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

/* =========================================================
   FILTER SELECT
========================================================= */

type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
};

function FilterSelect({
  value,
  onChange,
  options,
}: FilterSelectProps) {
  return (
    <div className="relative">

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 pr-9 text-sm outline-none transition hover:border-primary/40 focus:border-primary/50"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>

      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />

    </div>
  );
}

/* =========================================================
   REPOSITORY CARD
========================================================= */

type RepositoryCardProps = {
  repository: Repository;
  index: number;
};

function RepositoryCard({
  repository,
  index,
}: RepositoryCardProps) {
  const isHealthy = repository.score >= 85;

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay: index * 0.08,
      }}
      whileHover={{
        y: -4,
      }}
      className="group rounded-2xl border border-border/70 bg-card p-5 transition hover:border-primary/30 hover:shadow-xl sm:p-6"
    >

      {/* HEADER */}

      <div className="flex items-start justify-between gap-4">

        <div className="flex min-w-0 items-center gap-3">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Code2 size={21} />
          </div>

          <div className="min-w-0">

            <h3 className="truncate text-base font-semibold">
              {repository.name}
            </h3>

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

      {/* METRICS */}

      <div className="mt-6 grid grid-cols-3 gap-4">

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Health
          </p>

          <p
            className={`mt-1 text-2xl font-bold ${
              isHealthy
                ? "text-success"
                : "text-warning"
            }`}
          >
            {repository.score}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Findings
          </p>

          <p className="mt-1 text-2xl font-bold">
            {repository.findings}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Debt
          </p>

          <p className="mt-1 text-lg font-bold">
            {repository.debt}
          </p>
        </div>

      </div>

      {/* HEALTH PROGRESS */}

      <div className="mt-6">

        <div className="mb-2 flex items-center justify-between">

          <span className="text-xs text-muted-foreground">
            Health score
          </span>

          <span className="text-xs font-medium text-success">
            {repository.score >= 85
              ? "Excellent"
              : "Needs improvement"}
          </span>

        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">

          <motion.div
            initial={{
              width: 0,
            }}
            animate={{
              width: `${repository.score}%`,
            }}
            transition={{
              duration: 0.8,
              delay: index * 0.1,
            }}
            className={`h-full rounded-full ${
              isHealthy
                ? "bg-success"
                : "bg-warning"
            }`}
          />

        </div>

      </div>

      {/* FOOTER */}

      <div className="mt-6 flex flex-col justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">

        <div className="flex items-center gap-3">

          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {repository.language}
          </span>

          <span className="text-xs text-muted-foreground">
            {repository.lastAnalyzed}
          </span>

        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          View repository

          <ExternalLink size={14} />
        </button>

      </div>

    </motion.div>
  );
}