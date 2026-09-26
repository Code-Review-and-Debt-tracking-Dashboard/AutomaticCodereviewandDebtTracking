import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalMembersPage } from "../../pages/global/GlobalMembersPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({
    selectedOrg: { id: "org-1", login: "acme-corp", name: "Acme Corp" },
  }),
}));

const mockedApi = vi.mocked(api);

// The shape the API actually returns — flat, not nested under `user`.
const members = [
  { id: "m1", userId: "u1", username: "nethmib", avatarUrl: null, role: "OWNER", status: "ACTIVE" },
  { id: "m2", userId: "u2", username: "rumeshp", avatarUrl: null, role: "MEMBER", status: "ACTIVE" },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <GlobalMembersPage />
    </MemoryRouter>,
  );
}

describe("GlobalMembersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: members } as any);
  });

  it("renders members using the fields the API returns", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Members" })).toBeInTheDocument();
    expect(await screen.findByText("nethmib")).toBeInTheDocument();
    expect(screen.getByText("rumeshp")).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/orgs/org-1/members");
  });

  // membership comes from GitHub, so the page must not imply it can be edited here
  it("explains that membership is synced from GitHub", async () => {
    renderPage();

    expect(await screen.findByText(/synced from\s+GitHub/i)).toBeInTheDocument();
  });

  it("shows an empty state rather than a blank grid", async () => {
    mockedApi.get.mockResolvedValue({ data: [] } as any);
    renderPage();

    expect(await screen.findByText(/No members found for this organization/i)).toBeInTheDocument();
  });
});
