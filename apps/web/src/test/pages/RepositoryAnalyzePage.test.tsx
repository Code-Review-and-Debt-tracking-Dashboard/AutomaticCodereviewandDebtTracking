import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { RepositoryAnalyzePage } from "../../pages/repositories/RepositoryAnalyzePage";

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const mockedApi = vi.mocked(api);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1/analyze"]}>
      <Routes>
        <Route path="/repositories/:repoId/analyze" element={<RepositoryAnalyzePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryAnalyzePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pipeline steps and loads last analyzed info", async () => {
    mockedApi.get.mockResolvedValueOnce({
      id: "repo-1",
      name: "code-health",
      defaultBranch: "main",
      lastAnalyzedAt: "2026-09-20T10:00:00.000Z",
      healthScore: 85,
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Analyze" })).toBeInTheDocument();
    expect(await screen.findByText("Clone repository into the worker sandbox")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Last analyzed on branch: main/)).toBeInTheDocument();
    });
  });

  it("triggers analysis and shows success message on button click", async () => {
    mockedApi.get.mockResolvedValueOnce({
      id: "repo-1",
      name: "code-health",
      defaultBranch: "main",
      lastAnalyzedAt: null,
    });
    mockedApi.post.mockResolvedValueOnce({
      message: "Analysis queued",
      analysisId: "analysis-1",
      jobId: "job-1",
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("button", { name: /Run analysis/i });
    await user.click(screen.getByRole("button", { name: /Run analysis/i }));

    await waitFor(() => {
      expect(screen.getByText("Analysis queued")).toBeInTheDocument();
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/repos/repo-1/analyze");
  });
});
