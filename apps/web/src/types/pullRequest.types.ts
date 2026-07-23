// TODO(Backend): These types should match your API response schemas from /api/pull-requests/*

export type PRStatus = "open" | "merged" | "closed" | "draft";
export type PRReviewStatus = "approved" | "changes_requested" | "pending" | "dismissed";

export interface PullRequest {
  id: string;
  repositoryId: string;
  repositoryName: string;
  number: number;
  title: string;
  author: string;
  authorAvatar: string;
  status: PRStatus;
  reviewStatus: PRReviewStatus;
  healthScore: number | null;
  healthScoreChange: number | null;
  newFindings: number;
  resolvedFindings: number;
  linesAdded: number;
  linesRemoved: number;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
}
