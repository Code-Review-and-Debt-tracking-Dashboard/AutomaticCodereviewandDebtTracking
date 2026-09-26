import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { ProfilePage } from "../../pages/global/ProfilePage";

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn() },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      username: "nethmi",
      email: "nethmi@acme.com",
      avatarUrl: null,
      platformRole: "MEMBER",
    },
  }),
}));

vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({
    orgs: [
      { id: "org-1", login: "acme", name: "Acme Corp" },
      { id: "org-2", login: "beta", name: "Beta Inc" },
    ],
    selectedOrg: { id: "org-1", login: "acme", name: "Acme Corp" },
  }),
}));

const mockedApi = vi.mocked(api);

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders profile page with real user data from auth context", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{}, {}, {}] }); // 3 repos

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    // shows up twice
    expect(screen.getAllByText("nethmi").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("MEMBER")).toBeInTheDocument();
    expect(screen.getByText("nethmi@acme.com")).toBeInTheDocument();

    await waitFor(() => {
      // orgs count: 2
      expect(screen.getByText("2")).toBeInTheDocument();
      // repo count: 3
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });
});
