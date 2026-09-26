import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { RepositoryFilesPage } from "../../pages/repositories/RepositoryFilesPage";

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn() },
}));

const mockedApi = vi.mocked(api);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1/files"]}>
      <Routes>
        <Route path="/repositories/:repoId/files" element={<RepositoryFilesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryFilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders hotspot files from the API", async () => {
    mockedApi.get.mockResolvedValueOnce({
      snapshotId: "snap-1",
      files: [
        { filePath: "src/api/users.ts", debtMinutes: 30, totalFindings: 5 },
        { filePath: "src/services/analyzer.ts", debtMinutes: 15, totalFindings: 2 },
      ],
    });

    renderPage();

    expect(screen.getByRole("heading", { name: "Files" })).toBeInTheDocument();

    await waitFor(() => {
      const matches = screen.getAllByText("src/api/users.ts");
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("src/services/analyzer.ts")).toBeInTheDocument();
    });

    expect(mockedApi.get).toHaveBeenCalledWith("/api/repos/repo-1/hotspots", { limit: 100 });
  });

  it("shows empty state when no files are returned", async () => {
    mockedApi.get.mockResolvedValueOnce({ snapshotId: null, files: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No files found for this repository snapshot.")).toBeInTheDocument();
    });
  });
});
