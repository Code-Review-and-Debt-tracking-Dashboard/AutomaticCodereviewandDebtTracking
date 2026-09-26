import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { RepositoryAnalyzePage } from "../../pages/repositories/RepositoryAnalyzePage";

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const mockedApi = vi.mocked(api);

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "analysis-1",
    status: "COMPLETED",
    trigger: "MANUAL",
    branch: "main",
    commitSha: "abc1234def",
    errorMessage: null,
    queuedAt: "2026-09-20T10:00:00.000Z",
    startedAt: "2026-09-20T10:00:05.000Z",
    completedAt: "2026-09-20T10:01:00.000Z",
    ...overrides,
  };
}

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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders pipeline steps and the latest run", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [run()] });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Analyze" })).toBeInTheDocument();
    expect(screen.getByText("Clone repository into the worker sandbox")).toBeInTheDocument();
    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("manual run on main @ abc1234")).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/repos/repo-1/analyses");
  });

  it("links a finished run to its results", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [run()] });

    renderPage();

    expect(await screen.findByRole("link", { name: /view results/i })).toHaveAttribute(
      "href",
      "/repositories/repo-1",
    );
  });

  it("says it is loading instead of claiming nothing has run", async () => {
    mockedApi.get.mockReturnValueOnce(new Promise(() => {}));

    renderPage();

    expect(await screen.findByText(/loading analysis runs/i)).toBeInTheDocument();
    expect(screen.queryByText(/no analysis has run yet/i)).not.toBeInTheDocument();
  });

  it("shows the error when runs can't be loaded", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { data: { error: { message: "Repository not found" } } },
    });

    renderPage();

    expect(await screen.findByText("Repository not found")).toBeInTheDocument();
  });

  it("shows an empty state when nothing has run", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    renderPage();

    expect(await screen.findByText("No analysis has run yet for this repository.")).toBeInTheDocument();
  });

  it("shows why a failed run failed", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: [run({ status: "FAILED", errorMessage: "clone: repository not found" })],
    });

    renderPage();

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Error: clone: repository not found")).toBeInTheDocument();
  });

  it("triggers analysis and shows the queued run", async () => {
    mockedApi.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [run({ status: "PENDING", commitSha: "HEAD", startedAt: null, completedAt: null })] });
    mockedApi.post.mockResolvedValueOnce({
      message: "Analysis queued",
      analysisId: "analysis-1",
      jobId: "job-1",
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("No analysis has run yet for this repository.");
    await user.click(screen.getByRole("button", { name: /Run analysis/i }));

    expect(await screen.findByText("Analysis queued")).toBeInTheDocument();
    expect(await screen.findByText("Queued")).toBeInTheDocument();
    expect(mockedApi.post).toHaveBeenCalledWith("/api/repos/repo-1/analyze");
    expect(screen.getByRole("button", { name: /Run analysis/i })).toBeDisabled();
  });

  it("keeps checking while running and stops once it completes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedApi.get
      .mockResolvedValueOnce({ data: [run({ status: "RUNNING", completedAt: null })] })
      .mockResolvedValueOnce({ data: [run()] });

    renderPage();

    expect(await screen.findByText("Running")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(await screen.findByText("Completed")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledTimes(2));
  });
});
