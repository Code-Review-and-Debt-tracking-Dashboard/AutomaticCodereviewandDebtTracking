export interface CopyableFinding {
  severity: string;
  file: string | null;
  line: number | null;
  message: string;
  tool: string;
  rule?: string;
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

const rank = (f: CopyableFinding) => SEVERITY_ORDER.indexOf(f.severity.toUpperCase());

// plain markdown a coding agent can act on, pasted in by the user
export function formatForAgent(
  findings: CopyableFinding[],
  source: { repoUrl: string; commitSha: string },
): string {
  const repo = source.repoUrl.replace("https://github.com/", "");
  const noun = findings.length === 1 ? "finding" : "findings";

  const lines = [...findings]
    .sort((a, b) => rank(a) - rank(b))
    .map((f, i) => {
      const where = f.file ? (f.line ? `${f.file}:${f.line}` : f.file) : "(no file)";
      const origin = f.rule ? `${f.tool}: ${f.rule}` : f.tool;
      return `${i + 1}. [${f.severity.toUpperCase()}] ${where} — ${f.message} (${origin})`;
    });

  return (
    `Fix these static-analysis ${noun} in ${repo} ` +
    `(at commit ${source.commitSha.slice(0, 7)}, line numbers match that commit):\n\n` +
    lines.join("\n") +
    "\n"
  );
}
