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

const summary = {
  total: 7,
  new: 5,
  carryOver: 2,
  bySeverity: { critical: 3, high: 0, medium: 0, low: 4, info: 0 },
  byCategory: {},
};

// the PR endpoint returns snapshots; findings come from the newest snapshot
function mockApi(data = snapshotFindings) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes("/pulls/")) {
      return Promise.resolve({
        title: "Add login rate limit",
        htmlUrl: "https://github.com/acme/demo/pull/42",
        authorLogin: "octocat",
        snapshots: [{ id: "snap-1", createdAt: "2026-09-23T09:00:00.000Z" }],
      } as any);
    }
    return Promise.resolve({
      repoUrl: "https://github.com/acme/demo",
      commitSha: "abc123",
      summary,
      data,
      pagination: { totalPages: 1 },
    } as any);
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

  it("filters by severity and category even though the API sends uppercase values", async () => {
    mockApi();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Hardcoded API key detected")).toBeInTheDocument();
    });

    const [severitySelect, categorySelect] = screen.getAllByRole("combobox");
    await user.selectOptions(severitySelect, "Critical");
    await user.selectOptions(categorySelect, "Vulnerability");
    expect(screen.getByText("Hardcoded API key detected")).toBeInTheDocument();

    await user.selectOptions(severitySelect, "Low");
    expect(screen.getByText("No findings match your criteria")).toBeInTheDocument();
  });

  it("shows real counts and the PR author", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("octocat")).toBeInTheDocument();
    });
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the PR title and links to GitHub", async () => {
    mockApi();

    renderPage();

    expect(await screen.findByText("Add login rate limit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open on GitHub/i })).toHaveAttribute(
      "href",
      "https://github.com/acme/demo/pull/42",
    );
    expect(screen.getByRole("link", { name: "src/config.ts:12" })).toHaveAttribute(
      "href",
      "https://github.com/acme/demo/blob/abc123/src/config.ts#L12",
    );
  });

  it("says the PR has not been analyzed instead of showing invented findings", async () => {
    mockedApi.get.mockResolvedValue({ snapshots: [] } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/has not been analyzed yet/i)).toBeInTheDocument();
    });
  });
});
