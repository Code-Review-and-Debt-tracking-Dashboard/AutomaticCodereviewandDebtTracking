import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRFindingDrilldownPage } from "../../pages/repositories/PRFindingDrilldownPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

const mockDrilldownFindings = [
  {
    id: "FND-100",
    message: "Hardcoded API key detected",
    category: "Security",
    severity: "Critical",
    file: "src/config.ts",
    line: 12,
    state: "New",
    tool: "Gitleaks",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1/pull-requests/42/findings"]}>
      <Routes>
        <Route
          path="/repositories/:repoId/pull-requests/:prNumber/findings"
          element={<PRFindingDrilldownPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PRFindingDrilldownPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders PR findings drilldown report", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockDrilldownFindings });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Hardcoded API key detected")).toBeInTheDocument();
      expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
    });
  });

  it("filters findings by search query", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockDrilldownFindings });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Hardcoded API key detected")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search findings.../i);
    await user.type(searchInput, "nonexistent");

    expect(screen.getByText("No findings match your criteria")).toBeInTheDocument();
  });
});
