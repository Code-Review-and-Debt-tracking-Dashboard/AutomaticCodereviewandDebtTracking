import { describe, expect, it } from "vitest";

import { formatForAgent } from "../../lib/copyFindings";

const source = { repoUrl: "https://github.com/acme/api-gateway", commitSha: "abc1234def5678" };

describe("formatForAgent", () => {
  it("lists findings most severe first, with repo and commit in the header", () => {
    const text = formatForAgent(
      [
        { severity: "LOW", file: "src/a.ts", line: 4, message: "Unused variable", tool: "eslint", rule: "no-unused-vars" },
        { severity: "Critical", file: "src/config.ts", line: 12, message: "Hardcoded API key", tool: "eslint", rule: "security/detect-secret" },
      ],
      source,
    );

    expect(text).toBe(
      "Fix these static-analysis findings in acme/api-gateway (at commit abc1234, line numbers match that commit):\n\n" +
        "1. [CRITICAL] src/config.ts:12 — Hardcoded API key (eslint: security/detect-secret)\n" +
        "2. [LOW] src/a.ts:4 — Unused variable (eslint: no-unused-vars)\n",
    );
  });

  it("handles one finding with no line or file", () => {
    const text = formatForAgent(
      [{ severity: "MEDIUM", file: "src/big.py", line: null, message: "Duplicated block", tool: "jscpd" }],
      source,
    );
    expect(text).toContain("static-analysis finding in acme/api-gateway");
    expect(text).toContain("1. [MEDIUM] src/big.py — Duplicated block (jscpd)");

    const noFile = formatForAgent(
      [{ severity: "INFO", file: null, line: null, message: "Repo-wide note", tool: "radon" }],
      source,
    );
    expect(noFile).toContain("1. [INFO] (no file) — Repo-wide note (radon)");
  });
});
