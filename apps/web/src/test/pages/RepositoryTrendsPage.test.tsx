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
});
