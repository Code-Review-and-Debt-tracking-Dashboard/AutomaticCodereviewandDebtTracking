// Contract for the bulk repository link queue. Same reason as the analysis
// queue: the API adds these jobs and the worker reads them, so the name and
// the payload shape live in one place.

export const BULK_LINK_QUEUE_NAME = 'bulk-link-queue';

export interface BulkLinkJobData {
  userId: string;
  orgId: string;
  githubRepoIds: number[];
}

// NO_CREDENTIAL and CREDENTIAL_DECRYPT_FAILED are the job giving up early —
// every remaining repo would fail the same way. They're kept apart because one
// is fixed by signing in again and the other only by fixing the server key.
export type BulkLinkStatus =
  | 'LINKED'
  | 'ALREADY_LINKED'
  | 'NO_ADMIN'
  | 'NOT_IN_ORG'
  | 'NOT_FOUND'
  | 'NO_CREDENTIAL'
  | 'CREDENTIAL_DECRYPT_FAILED'
  | 'GITHUB_ERROR';

export interface BulkLinkRepoResult {
  githubRepoId: number;
  status: BulkLinkStatus;
  fullName?: string;
  message?: string;
}

export interface BulkLinkJobResult {
  results: BulkLinkRepoResult[];
  summary: Record<BulkLinkStatus, number>;
}

export interface BulkLinkProgress {
  done: number;
  total: number;
}
