// TODO(Backend): These types should match your API response schemas from /api/repositories/*

export type Language = "TypeScript" | "JavaScript" | "Python" | "Java" | "Go" | "Rust" | "C#" | "Ruby" | "Swift" | "Kotlin";

export interface Repository {
  id: string;
  name: string;
  fullName: string;         // e.g. "org/repo-name"
  description: string;
  language: Language;
  isPrivate: boolean;
  healthScore: number;       // 0–100
  healthScoreChange: number; // e.g. +3.2 or -1.5
  techDebtHours: number;
  openFindings: number;
  criticalFindings: number;
  openPRs: number;
  lastScanAt: string | null;
  stars: number;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryStats {
  totalRepos: number;
  avgHealthScore: number;
  totalDebtHours: number;
  totalFindings: number;
}

export interface RepositoryFilters {
  search: string;
  language: Language | "all";
  sortBy: "name" | "healthScore" | "lastScan" | "findings";
  sortOrder: "asc" | "desc";
}
