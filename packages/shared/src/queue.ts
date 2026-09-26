// shared by the API and worker so they can't drift apart

export const ANALYSIS_QUEUE_NAME = 'analysis-queue';

export interface AnalysisJobData {
  analysisId: string;
  repoId: string;
  // null for manual runs
  prNumber: number | null;
  branch: string;
  commitSha: string;
  cloneUrl: string;
}
