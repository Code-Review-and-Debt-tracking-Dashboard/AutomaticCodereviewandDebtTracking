import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalPullRequestsPage } from "../../pages/global/GlobalPullRequestsPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({
    selectedOrg: { id: "org-1", login: "acme-corp", name: "Acme Corp" },
  }),
}));

const mockedApi = vi.mocked(api);

const mockPRData = {
  stats: {
    totalAnalyzed: 14,
    gatePassed: 10,
    needsAttention: 4,
    avgHealthScore: "85.2",
    avgHealthScoreDelta: "-15m",
  },
  pullRequests: [
    {
      id: 1,
      repoId: "repo-1",
      repoName: "acme-corp/api-gateway",
      title: "Add rate limiting middleware",
      author: "octocat",
      branch: "feature/rate-limit",
      score: 88,
      findings: 2,
      debtDelta: 15,
      status: "PASSED",
      time: "2026-09-20T12:00:00Z",
      htmlUrl: "https://github.com/acme-corp/api-gateway/pull/1",
    },
  ],
};

describe("GlobalPullRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and displays PR statistics and PR scan history table", async () => {
    mockedApi.get.mockResolvedValue(mockPRData);

    render(
      <MemoryRouter>
        <GlobalPullRequestsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Pull Requests" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Add rate limiting middleware/i)).toBeInTheDocument();
      expect(screen.getByText("85.2")).toBeInTheDocument();
    });
  });

  it("shows a dash instead of a score for a PR that was never analysed", async () => {
    mockedApi.get.mockResolvedValue({
      ...mockPRData,
      pullRequests: [{ ...mockPRData.pullRequests[0], score: null, status: "Pending" }],
    });

    render(
      <MemoryRouter>
        <GlobalPullRequestsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("HEALTH SCORE —")).toBeInTheDocument();
  });

  it("opens the PR's findings when a row is clicked", async () => {
    mockedApi.get.mockResolvedValue(mockPRData);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/pull-requests"]}>
        <Routes>
          <Route path="/pull-requests" element={<GlobalPullRequestsPage />} />
          <Route
            path="/repositories/:repoId/pull-requests/:prNumber/findings"
            element={<p>drilldown page</p>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText(/Add rate limiting middleware/i));

    expect(screen.getByText("drilldown page")).toBeInTheDocument();
  });

  it("shows the error instead of an empty list when loading fails", async () => {
    mockedApi.get.mockRejectedValue({
      response: { data: { error: { message: "Organization not found" } } },
    });

    render(
      <MemoryRouter>
        <GlobalPullRequestsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Organization not found")).toBeInTheDocument();
    expect(screen.queryByText("No pull requests found.")).not.toBeInTheDocument();
  });
});
