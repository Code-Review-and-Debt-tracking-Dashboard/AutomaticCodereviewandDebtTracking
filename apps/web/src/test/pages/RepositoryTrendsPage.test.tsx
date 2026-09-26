import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryTrendsPage } from "../../pages/repositories/RepositoryTrendsPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

const mockedApi = vi.mocked(api);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1/trends"]}>
      <Routes>
        <Route path="/repositories/:repoId/trends" element={<RepositoryTrendsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryTrendsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays repository trend metrics and charts", async () => {
    mockedApi.get.mockResolvedValue({
      dataPoints: [
        { date: "2026-06-16", healthScore: 72 },
        { date: "2026-06-17", healthScore: 88 },
      ],
    });

    renderPage();

    expect(screen.getByRole("heading", { name: "Repository Trends" })).toBeInTheDocument();
    expect(screen.getByText("Current Health")).toBeInTheDocument();
    expect(screen.getByText("Open Findings")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/repos/repo-1/trend?days=30");
    });
  });

  it("shows the real change and links each recent analysis to its findings", async () => {
    mockedApi.get.mockResolvedValue({
      dataPoints: [
        { date: "2026-09-20T10:00:00Z", healthScore: 70, snapshotId: "snap-1" },
        { date: "2026-09-21T10:00:00Z", healthScore: 75, snapshotId: "snap-2" },
      ],
    });

    renderPage();

    expect(await screen.findByText("+5 points")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /view findings/i });
    expect(links[0]).toHaveAttribute("href", "/repositories/repo-1/findings?snapshot=snap-2");
    expect(links[1]).toHaveAttribute("href", "/repositories/repo-1/findings?snapshot=snap-1");
  });

  it("says it is loading, then shows the error if the trend can't be loaded", async () => {
    let fail!: (err: unknown) => void;
    mockedApi.get.mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));

    renderPage();

    expect(await screen.findByText(/loading trends/i)).toBeInTheDocument();
    fail({ response: { data: { error: { message: "Repository not found" } } } });
    expect(await screen.findByText("Repository not found")).toBeInTheDocument();
  });
});
