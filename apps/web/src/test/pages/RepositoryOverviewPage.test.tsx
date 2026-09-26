import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { RepositoryOverviewPage } from "../../pages/repositories/RepositoryOverviewPage";

vi.mock("../../lib/apiClient", () => ({ api: { get: vi.fn() } }));

const mockedApi = vi.mocked(api);

function mockApi(runStatus: () => string) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.endsWith("/analyses")) {
      return Promise.resolve({
        data: [{ id: "run-1", status: runStatus(), branch: "main", errorMessage: null }],
      } as any);
    }
    if (url === "/api/repos/repo-1") {
      return Promise.resolve({ id: "repo-1", name: "demo", fullName: "acme/demo", healthScore: null } as any);
    }
    // trend, debt, hotspots and notifications: nothing yet
    return Promise.reject({ response: { status: 404 } });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1"]}>
      <Routes>
        <Route path="/repositories/:repoId" element={<RepositoryOverviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says an analysis is running and reloads when it finishes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let status = "RUNNING";
    mockApi(() => status);

    renderPage();

    expect(await screen.findByText(/Analysis running on main/i)).toBeInTheDocument();

    status = "COMPLETED";
    await vi.advanceTimersByTimeAsync(5000);

    await waitFor(() => {
      expect(screen.queryByText(/Analysis running on main/i)).not.toBeInTheDocument();
    });
    const detailCalls = mockedApi.get.mock.calls.filter(([url]) => url === "/api/repos/repo-1");
    expect(detailCalls).toHaveLength(2);
  });

  it("points to the Analyze page when the last run failed", async () => {
    mockApi(() => "FAILED");

    renderPage();

    expect(await screen.findByText(/last analysis failed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see details/i })).toHaveAttribute(
      "href",
      "/repositories/repo-1/analyze",
    );
  });

  it("explains the score and what changed since the last analysis", async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === "/api/repos/repo-1") {
        return Promise.resolve({ id: "repo-1", name: "demo", fullName: "acme/demo", healthScore: 45 } as any);
      }
      if (url.includes("/trend")) {
        return Promise.resolve({
          dataPoints: [
            { date: "2026-09-20T10:00:00Z", healthScore: 52, totalIssues: 10, vulnerabilityCount: 1 },
            { date: "2026-09-21T10:00:00Z", healthScore: 45, totalIssues: 14, vulnerabilityCount: 3 },
          ],
        } as any);
      }
      if (url.endsWith("/analyses")) return Promise.resolve({ data: [] } as any);
      return Promise.reject({ response: { status: 404 } });
    });

    renderPage();

    expect(await screen.findByText(/Significant quality problems/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Since the last analysis: score −7 · \+4 findings · \+2 vulnerabilities/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see findings/i })).toHaveAttribute(
      "href",
      "/repositories/repo-1/findings",
    );
  });
});
