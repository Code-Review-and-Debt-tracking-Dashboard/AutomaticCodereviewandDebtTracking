// what the worker sends back to the API. no field holds source code

// same as the db enums
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type FindingCategory =
  | 'VULNERABILITY'
  | 'COMPLEXITY'
  | 'DUPLICATION'
  | 'CODE_SMELL'
  | 'MAINTAINABILITY';

export type FindingState = 'NEW' | 'EXISTING' | 'RESOLVED' | 'UNKNOWN';

export type GateResult = 'PASS' | 'FAIL';

export type AnalysisStage =
  | 'clone'
  | 'detect'
  | 'analyze'
  | 'normalize'
  | 'score'
  | 'gate'
  | 'comment'
  | 'persist';

// not every tool gives positions, so they can be null
export interface AnalysisFinding {
  file: string | null;
  line: number | null;
  endLine: number | null;
  column: number | null;
  endColumn: number | null;
  severity: Severity;
  category: FindingCategory;
  state: FindingState;
  rule: string;
  message: string;
  tool: string;
  debtMinutes: number;
}

export interface SnapshotMetrics {
  healthScore: number;
  debtMinutes: number;
  debtDeltaMinutes: number;
  vulnerabilityCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  complexityCount: number;
  duplicationCount: number;
  codeSmellCount: number;
  maintainabilityCount: number;
  duplicationPct: number;
  totalIssues: number;
  linesOfCode: number;
  // null if the gate stage never ran
  gateResult: GateResult | null;
}

// null max* = not enforced
export interface QualityGateThresholds {
  minHealthScore: number;
  maxCriticalFindings: number | null;
  maxVulnerabilities: number | null;
  maxDuplicationPct: number | null;
  maxComplexityCount: number | null;
  maxCodeSmellCount: number | null;
  blockPR: boolean;
}

// the previous run to compare against
export interface BaselineSnapshot {
  healthScore: number;
  findings: AnalysisFinding[];
}

export interface AnalysisResultsPayload {
  analysisId: string;
  // real sha, manual runs are queued as HEAD
  commitSha: string;
  metrics: SnapshotMetrics;
  findings: AnalysisFinding[];
  toolVersions: Record<string, string>;
  // no analyzer could read the repo
  analysisLimited: boolean;
}

export interface AnalysisFailurePayload {
  analysisId: string;
  stage: AnalysisStage;
  errorMessage: string;
  retryCount: number;
}
