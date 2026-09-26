import { api } from "./apiClient";

export interface ApiFinding {
  id: string;
  file: string | null;
  line: number | null;
  severity: string;
  category: string;
  rule: string;
  message: string;
  tool: string;
  isNew: boolean;
  debtMinutes: number;
}

export interface FindingsSummary {
  total: number;
  new: number;
  carryOver: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface AllFindings {
  summary: FindingsSummary;
  data: ApiFinding[];
}

interface FindingsPage extends AllFindings {
  pagination: { totalPages: number };
}

// API uses SCREAMING_SNAKE; the UI reads better in title case.
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// the endpoint caps a page at 100, so keep asking until every page is in
export async function fetchAllFindings(snapshotId: string): Promise<AllFindings> {
  const url = `/api/snapshots/${snapshotId}/findings`;
  const first = await api.get<FindingsPage>(url, { limit: 100, page: 1 });
  const data = [...first.data];

  for (let page = 2; page <= first.pagination.totalPages; page++) {
    const res = await api.get<FindingsPage>(url, { limit: 100, page });
    data.push(...res.data);
  }

  return { summary: first.summary, data };
}
