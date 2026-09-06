// The other half of the contract: what the worker sends back once it has
// finished a job. The API is the only thing that writes to the database, so
// these are the shapes it accepts over HTTP.
//
// Every field here is finding metadata or an aggregate number. There is
// deliberately nowhere to put source code, so source can't leave the machine
// that cloned it even by mistake.

// Same spelling as the database enums, so results persist without a mapping step.
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

// One issue, after the normalize stage has flattened every tool into one shape.
// Positions are nullable because not every tool reports them.
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

// The aggregate numbers for one run, as they end up on the health snapshot.
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
  // Null when the repo has no quality gate configured.
  gateResult: GateResult | null;
}

export interface AnalysisResultsPayload {
  analysisId: string;
  // The sha actually checked out. Manual runs are queued as 'HEAD', so the
  // queued value can't be trusted here.
  commitSha: string;
  metrics: SnapshotMetrics;
  findings: AnalysisFinding[];
  // Tool name to version, so an old score can be explained later.
  toolVersions: Record<string, string>;
  // True when nothing in the repo had an analyzer that could read it.
  analysisLimited: boolean;
}

export interface AnalysisFailurePayload {
  analysisId: string;
  stage: AnalysisStage;
  errorMessage: string;
}
