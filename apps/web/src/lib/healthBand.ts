/*
 * One definition of the Health Score bands for the whole dashboard. The same
 * five bands the worker puts in its PR comment, so a score never reads one way
 * on GitHub and another way here.
 *
 * `meaning` is written for someone with no background in code quality — it is
 * what the UI shows on hover.
 */

export type HealthTone = "success" | "info" | "warning" | "destructive" | "muted";

export interface HealthBand {
  label: string;
  tone: HealthTone;
  /** Tailwind classes for text, used where a Badge variant isn't available. */
  textClass: string;
  meaning: string;
}

const NOT_ANALYZED: HealthBand = {
  label: "Not analyzed",
  tone: "muted",
  textClass: "text-muted-foreground",
  meaning: "This repository has not been analyzed yet, so there is no score.",
};

export function healthBand(score: number | null | undefined): HealthBand {
  if (score === null || score === undefined) return NOT_ANALYZED;

  if (score >= 90) {
    return {
      label: "Excellent",
      tone: "success",
      textClass: "text-success",
      meaning: "Very few issues. The code is in good shape.",
    };
  }
  if (score >= 70) {
    return {
      label: "Good",
      tone: "info",
      textClass: "text-info",
      meaning: "Acceptable quality, with some issues worth addressing.",
    };
  }
  if (score >= 50) {
    return {
      label: "Fair",
      tone: "warning",
      textClass: "text-warning",
      meaning: "Noticeable technical debt. This needs attention soon.",
    };
  }
  if (score >= 25) {
    return {
      label: "Poor",
      tone: "destructive",
      textClass: "text-destructive",
      meaning: "Significant quality problems. Cleanup should be prioritised.",
    };
  }
  return {
    label: "Critical",
    tone: "destructive",
    textClass: "text-destructive",
    meaning: "Severe issues. The health of this codebase is at risk.",
  };
}

// Plain-English explanations of the metrics, for readers who do not work in the
// code. Shown on hover next to each number.
export const METRIC_HELP = {
  healthScore:
    "A single 0–100 rating of code quality. Higher is better. It falls as more problems are found.",
  openFindings:
    "How many problems the analysis found in the code, from minor style issues to security risks.",
  technicalDebt:
    "An estimate of how long it would take to fix everything that was found.",
  duplication:
    "How much of the code is copy-pasted elsewhere. Duplicated code has to be fixed in several places.",
  complexity:
    "Parts of the code with many branching paths. These are harder to change safely and harder to test.",
  vulnerabilities:
    "Problems that could be exploited, such as running text as code or leaking a secret.",
  codeSmells:
    "Code that works but is written in a way that will make future changes harder.",
  maintainability:
    "Notes left in the code, such as TODOs, that flag unfinished work.",
  qualityGate:
    "A pass/fail check. The gate fails when a repository crosses the limits set for it.",
} as const;
