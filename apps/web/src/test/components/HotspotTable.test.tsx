import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HotspotTable } from "../../components/hotspots/HotspotTable";

describe("HotspotTable Component", () => {
  it("renders files and health scores", () => {
    const files = [
      {
        file: "src/api/users.ts",
        healthScore: 45,
        debtMinutes: 120,
        openFindings: 5,
        totalFindings: 5,
        newFindings: 1,
        bySeverity: { critical: 1, high: 2, medium: 1, low: 1, info: 0 },
      },
    ];
    render(<HotspotTable files={files} />);
    expect(screen.getByText("src/api/users.ts")).toBeInTheDocument();
  });
});
