import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
});
