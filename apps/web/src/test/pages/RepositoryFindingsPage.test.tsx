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
        repoUrl: "https://github.com/acme/demo",
        commitSha: "abc123",
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

  it("links a finding's location to that line on GitHub", async () => {
    renderPage();

    const link = await screen.findByRole("link", { name: /src\/index\.js/ });
    expect(link).toHaveAttribute("href", "https://github.com/acme/demo/blob/abc123/src/index.js#L11");
  });

  it("copies only the filtered findings, or a single one, for a coding agent", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("eval with expression detected");

    await user.selectOptions(screen.getByRole("combobox"), "High");
    await user.click(screen.getByRole("button", { name: "Copy 1 finding" }));
    const filtered = await navigator.clipboard.readText();
    expect(filtered).toContain("in acme/demo (at commit abc123");
    expect(filtered).toContain("1. [HIGH] src/index.js:11 — eval with expression detected");
    expect(filtered).not.toContain("Unused variable");

    await user.selectOptions(screen.getByRole("combobox"), "All");
    await user.click(screen.getAllByRole("button", { name: "Copy this finding" })[1]);
    const single = await navigator.clipboard.readText();
    expect(single).toContain("1. [MEDIUM] src/users.js:4 — Unused variable detected");
    expect(single).not.toContain("eval");
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

  it("opens an older analysis when given ?snapshot=", async () => {
    renderPage("/repositories/repo-1/findings?snapshot=snap-old");

    expect(await screen.findByText(/showing an older analysis/i)).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/snapshots/snap-old/findings", { limit: 100, page: 1 });
    expect(screen.getByRole("link", { name: /view latest/i })).toHaveAttribute(
      "href",
      "/repositories/repo-1/findings",
    );
  });
});
