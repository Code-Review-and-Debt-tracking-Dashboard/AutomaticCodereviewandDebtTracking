import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { GlobalAnalyticsPage } from "../../pages/global/GlobalAnalyticsPage";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock("../../lib/apiClient", () => ({ api: { get: vi.fn() } }));

vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({ selectedOrg: { id: "org-1", login: "acme", name: "Acme" } }),
}));

const mockedApi = vi.mocked(api);

const repos = [
  {
    id: "repo-1",
    name: "code-health",
    fullName: "acme/code-health",
    language: "TypeScript",
    healthScore: 91,
    openFindings: 3,
    debtMinutes: 125,
  },
  {
    id: "repo-2",
    name: "analysis-worker",
    fullName: "acme/analysis-worker",
    language: "Python",
    healthScore: null,
    openFindings: null,
    debtMinutes: null,
  },
];

function mockApi(list = repos) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes("/trend")) return Promise.resolve({ dataPoints: [] } as any);
    return Promise.resolve({ data: list } as any);
  });
}

function renderAnalyticsPage() {
  return render(
    <MemoryRouter>
      <GlobalAnalyticsPage />
    </MemoryRouter>,
  );
}

describe("GlobalAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it("renders page header and stat metrics", async () => {
    renderAnalyticsPage();

    expect(screen.getByRole("heading", { name: "Organization Analytics" })).toBeInTheDocument();
    expect(screen.getAllByText("Average Health Score")[0]).toBeInTheDocument();
    // repo-2 has no snapshot, so the average is 91, not 45.5
    expect(await screen.findByText("91.0")).toBeInTheDocument();
  });

  it("shows repositories returned for the selected organization", async () => {
    renderAnalyticsPage();

    expect(await screen.findByText("code-health")).toBeInTheDocument();
    expect(screen.getByText("analysis-worker")).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/orgs/org-1/repos");
  });

  it("filters the analytics table using the search input", async () => {
    const user = userEvent.setup();
    renderAnalyticsPage();

    expect(await screen.findByText("code-health")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Search repositories.../i), "analysis");

    await waitFor(() => {
      expect(screen.queryByText("code-health")).not.toBeInTheDocument();
    });
    expect(screen.getByText("analysis-worker")).toBeInTheDocument();
  });

  it("shows an empty state when the organization has no repositories", async () => {
    mockApi([]);
    renderAnalyticsPage();

    expect(await screen.findByText(/No repositories linked in this organization yet/i)).toBeInTheDocument();
  });
});
