// shared by the API and worker for the bulk link queue

export const BULK_LINK_QUEUE_NAME = 'bulk-link-queue';

export interface BulkLinkJobData {
  userId: string;
  orgId: string;
  githubRepoIds: number[];
}

// NO_CREDENTIAL = sign in again, CREDENTIAL_DECRYPT_FAILED = server key is wrong
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
