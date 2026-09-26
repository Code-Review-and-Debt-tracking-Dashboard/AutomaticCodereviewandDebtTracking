import { describe, expect, it } from "vitest";

import { healthBand } from "../../lib/healthBand";

// The boundaries are the whole point: they must match the worker's PR comment
// and the band table in the scoring documentation.
describe("healthBand", () => {
  it.each([
    [100, "Excellent"],
    [90, "Excellent"],
    [89, "Good"],
    [70, "Good"],
    [69, "Fair"],
    [50, "Fair"],
    [49, "Poor"],
    [25, "Poor"],
    [24, "Critical"],
    [0, "Critical"],
  ])("scores %i as %s", (score, label) => {
    expect(healthBand(score).label).toBe(label);
  });

  it("treats an unanalysed repository as its own state, not a bad score", () => {
    expect(healthBand(null).label).toBe("Not analyzed");
    expect(healthBand(undefined).label).toBe("Not analyzed");
    expect(healthBand(null).tone).toBe("muted");
  });

  it("explains every band in plain language", () => {
    for (const score of [100, 80, 60, 30, 10]) {
      const band = healthBand(score);
      expect(band.meaning.length).toBeGreaterThan(20);
      expect(band.meaning).not.toMatch(/cyclomatic|lint|AST|heuristic/i);
    }
  });
});
