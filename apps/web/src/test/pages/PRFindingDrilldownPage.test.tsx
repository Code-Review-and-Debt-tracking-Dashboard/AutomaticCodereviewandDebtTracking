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

const snapshotFindings = [
  {
    id: "FND-100",
    message: "Hardcoded API key detected",
    category: "VULNERABILITY",
    severity: "CRITICAL",
    file: "src/config.ts",
    line: 12,
    rule: "security/detect-secret",
    tool: "eslint",
    isNew: true,
  },
];

// the PR endpoint returns snapshots; findings come from the newest snapshot
function mockApi(data = snapshotFindings) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes("/pulls/")) {
      return Promise.resolve({
        snapshots: [{ id: "snap-1", createdAt: "2026-09-23T09:00:00.000Z" }],
      } as any);
    }
    return Promise.resolve({ data } as any);
  });
}

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
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Hardcoded API key detected")).toBeInTheDocument();
      expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
    });
  });

  it("filters findings by search query", async () => {
    mockApi();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Hardcoded API key detected")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search findings.../i);
    await user.type(searchInput, "nonexistent");

    expect(screen.getByText("No findings match your criteria")).toBeInTheDocument();
  });

  it("says the PR has not been analyzed instead of showing invented findings", async () => {
    mockedApi.get.mockResolvedValue({ snapshots: [] } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/has not been analyzed yet/i)).toBeInTheDocument();
    });
  });
});
