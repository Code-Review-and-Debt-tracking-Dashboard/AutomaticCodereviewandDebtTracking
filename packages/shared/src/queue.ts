// The contract between the API (producer) and the worker (consumer). Both
// import from here so the queue name and payload shape can't drift apart.

export const ANALYSIS_QUEUE_NAME = 'analysis-queue';

export interface AnalysisJobData {
  analysisId: string;
  repoId: string;
  // Null for manual analyses, which aren't tied to a pull request.
  prNumber: number | null;
  branch: string;
  commitSha: string;
  cloneUrl: string;
}
