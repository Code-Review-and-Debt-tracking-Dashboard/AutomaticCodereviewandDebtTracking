import { describe, expect, it } from "vitest";

import { describeChange } from "../../lib/scoreChange";

const before = { healthScore: 80, vulnerabilityCount: 1, complexityCount: 4, totalIssues: 10, duplicationPct: 2 };

describe("describeChange", () => {
  it("lists only what moved, with signs", () => {
    const after = { ...before, healthScore: 73.8, vulnerabilityCount: 4, complexityCount: 2 };
    expect(describeChange(before, after)).toEqual(["score −6.2", "+3 vulnerabilities", "−2 complexity"]);
  });

  it("includes duplication and total findings", () => {
    const after = { ...before, totalIssues: 15, duplicationPct: 3.5 };
    expect(describeChange(before, after)).toEqual(["+5 findings", "+1.5% duplication"]);
  });

  it("is empty when nothing changed", () => {
    expect(describeChange(before, { ...before })).toEqual([]);
  });
});
