import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryPullRequestsPage } from "../../pages/repositories/RepositoryPullRequestsPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

const mockPullItem = [
  {
    id: 10,
    title: "Add OAuth flow",
    author: "dev-one",
    branch: "feature/oauth",
    score: 95,
    findings: 1,
    debtDelta: -10,
    status: "Passed",
    time: "1 hour ago",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1/pull-requests"]}>
      <Routes>
        <Route path="/repositories/:repoId/pull-requests" element={<RepositoryPullRequestsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryPullRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders repository PRs", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockPullItem });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("#10 Add OAuth flow")).toBeInTheDocument();
      expect(screen.getByText("dev-one")).toBeInTheDocument();
      expect(screen.getByText("Passed")).toBeInTheDocument();
    });
  });

  it("filters pull requests using the search bar", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockPullItem });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("#10 Add OAuth flow")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search pull requests.../i);
    await user.type(searchInput, "nonexistent");

    expect(screen.getByText("No pull requests found.")).toBeInTheDocument();
  });
});
