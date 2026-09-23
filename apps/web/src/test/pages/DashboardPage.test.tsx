import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "../../pages/dashboard/DashboardPage";
import { api } from "../../lib/apiClient";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn() },
}));

vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({ selectedOrg: { id: "org-1", login: "acme", name: "Acme" } }),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", username: "rumesh" } }),
}));

const mockedApi = vi.mocked(api);

const repos = [
  {
    id: "repo-1",
    name: "analysed-repo",
    fullName: "acme/analysed-repo",
    language: "TypeScript",
    healthScore: 90,
    openFindings: 4,
    debtMinutes: 125,
    lastAnalyzedAt: "2026-09-20T10:00:00.000Z",
  },
  {
    id: "repo-2",
    name: "fresh-repo",
    fullName: "acme/fresh-repo",
    language: "Python",
    healthScore: null,
    openFindings: null,
    debtMinutes: null,
    lastAnalyzedAt: null,
  },
];

// the page fans out: repos, then a trend per repo, then notifications
function mockDashboard(list = repos) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes("/repos")) return Promise.resolve({ data: list } as any);
    if (url.includes("/trend")) return Promise.resolve({ dataPoints: [] } as any);
    if (url.includes("/notifications")) return Promise.resolve({ data: [] } as any);
    return Promise.resolve({} as any);
  });
}

function renderDashboardPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboard();
  });

  it("renders page header and stat cards", async () => {
    renderDashboardPage();

    expect(await screen.findByText(/overview of your code quality/i)).toBeInTheDocument();
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Average Health")).toBeInTheDocument();
    expect(screen.getByText("Open Findings")).toBeInTheDocument();
    expect(screen.getByText("Technical Debt")).toBeInTheDocument();
  });

  it("shows repositories returned by the API", async () => {
    renderDashboardPage();

    expect(await screen.findByText("analysed-repo")).toBeInTheDocument();
    expect(screen.getByText("fresh-repo")).toBeInTheDocument();
  });

  it("averages health over analysed repos only", async () => {
    renderDashboardPage();

    // repo-2 has no snapshot, so the average is 90, not 45
    expect(await screen.findByText("90.0")).toBeInTheDocument();
  });

  it("marks a repo with no snapshot as not analyzed", async () => {
    renderDashboardPage();

    expect(await screen.findByText("Not analyzed")).toBeInTheDocument();
  });

  it("filters repository list based on search text input", async () => {
    const user = userEvent.setup();
    renderDashboardPage();

    expect(await screen.findByText("analysed-repo")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Search repositories.../i), "fresh");

    await waitFor(() => {
      expect(screen.queryByText("analysed-repo")).not.toBeInTheDocument();
    });
    expect(screen.getByText("fresh-repo")).toBeInTheDocument();
  });

  it("shows an empty state when the org has no repositories", async () => {
    mockDashboard([]);
    renderDashboardPage();

    expect(await screen.findByText(/No repositories linked yet/i)).toBeInTheDocument();
  });
});
