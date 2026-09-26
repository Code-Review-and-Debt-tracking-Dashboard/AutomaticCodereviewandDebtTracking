import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { RepositoryQualityGatePage } from "../../pages/repositories/RepositoryQualityGatePage";

vi.mock("../../lib/apiClient", () => ({ api: { get: vi.fn(), put: vi.fn() } }));

const mockedApi = vi.mocked(api);

const gate = {
  repoId: "repo-1",
  minHealthScore: 75,
  maxCriticalFindings: 1,
  maxVulnerabilities: null,
  maxDuplicationPct: null,
  maxComplexityCount: null,
  maxCodeSmellCount: null,
  blockPR: true,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1/quality-gate"]}>
      <Routes>
        <Route path="/repositories/:repoId/quality-gate" element={<RepositoryQualityGatePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryQualityGatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays the saved quality gate", async () => {
    mockedApi.get
      .mockResolvedValueOnce({ data: gate })
      .mockResolvedValueOnce({ data: [] });
    renderPage();

    expect(screen.getByText(/Loading quality gate/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByDisplayValue("75")).toHaveLength(2);
    });
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(1);
    expect(screen.getAllByRole("checkbox", { name: "No limit" })[1]).toBeChecked();
  });

  it("updates a threshold and saves the edited gate", async () => {
    mockedApi.get
      .mockResolvedValueOnce({ data: gate })
      .mockResolvedValueOnce({ data: [] });
    mockedApi.put.mockResolvedValueOnce({ data: { ...gate, minHealthScore: 80 } });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0);
    });
    const healthScore = screen.getAllByRole("spinbutton")[0];
    await user.clear(healthScore);
    await user.type(healthScore, "80");
    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith(
        "/api/repos/repo-1/quality-gate",
        expect.objectContaining({ minHealthScore: 80 }),
      );
    });
  });

  it("shows a load error when the quality gate request fails", async () => {
    mockedApi.get
      .mockRejectedValueOnce({ response: { data: { error: { message: "Gate unavailable" } } } })
      .mockResolvedValueOnce({ data: [] });
    renderPage();

    expect(await screen.findByText("Gate unavailable")).toBeInTheDocument();
  });
});