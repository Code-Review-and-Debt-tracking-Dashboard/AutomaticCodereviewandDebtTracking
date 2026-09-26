import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { RepositoryFindingsPage } from "../../pages/repositories/RepositoryFindingsPage";

vi.mock("../../lib/apiClient", () => ({ api: { get: vi.fn() } }));

const mockedApi = vi.mocked(api);

const findings = [
  {
    id: "f-1",
    file: "src/index.js",
    line: 11,
    severity: "HIGH",
    category: "VULNERABILITY",
    rule: "security/detect-eval-with-expression",
    message: "eval with expression detected",
    tool: "eslint",
    isNew: true,
    debtMinutes: 30,
  },
  {
    id: "f-2",
    file: "src/users.js",
    line: 4,
    severity: "MEDIUM",
    category: "CODE_SMELL",
    rule: "no-unused-vars",
    message: "Unused variable detected",
    tool: "eslint",
    isNew: false,
    debtMinutes: 5,
  },
];

function mockApi(data = findings) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.endsWith("/debt")) return Promise.resolve({ snapshotId: "snap-1" } as any);
    if (url.includes("/findings")) {
      return Promise.resolve({
        snapshotId: "snap-1",
        summary: {
          total: data.length,
          new: data.filter((f) => f.isNew).length,
          carryOver: 0,
          bySeverity: { critical: 0, high: 1 },
          byCategory: {},
        },
        data,
        pagination: { totalPages: 1 },
      } as any);
    }
    return Promise.resolve({ name: "codehealth-pipeline-demo" } as any);
  });
}

function renderPage(url = "/repositories/repo-1/findings") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/repositories/:repoId/findings" element={<RepositoryFindingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryFindingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it("renders findings returned by the API", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument();
    expect(await screen.findByText("eval with expression detected")).toBeInTheDocument();
    expect(screen.getByText("src/index.js")).toBeInTheDocument();
    expect(screen.getByText("security/detect-eval-with-expression")).toBeInTheDocument();
  });

  it("filters findings using the search input", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("eval with expression detected")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Search findings.../i), "Unused variable");

    expect(screen.queryByText("eval with expression detected")).not.toBeInTheDocument();
    expect(screen.getByText("Unused variable detected")).toBeInTheDocument();
  });

  it("shows only one file's findings when opened from a hotspot", async () => {
    renderPage("/repositories/repo-1/findings?file=src%2Fusers.js");

    expect(await screen.findByText("Unused variable detected")).toBeInTheDocument();
    expect(screen.queryByText("eval with expression detected")).not.toBeInTheDocument();
  });

  it("says so when the analysis found nothing, rather than showing invented findings", async () => {
    mockApi([]);
    renderPage();

    expect(await screen.findByText(/came back clean/i)).toBeInTheDocument();
  });
});
