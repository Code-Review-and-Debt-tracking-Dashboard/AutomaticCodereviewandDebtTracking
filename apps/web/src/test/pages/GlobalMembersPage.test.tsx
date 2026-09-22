import { render, screen, waitFor } from "@testing-library/react";
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

describe("GlobalMembersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders organization members from the API", async () => {
    mockedApi.get.mockResolvedValue({
      data: [
        { id: "m1", user: { name: "Nethmi Bhagya", email: "nethmi@acme.com" }, role: "OWNER" },
        { id: "m2", user: { name: "Rumesh Perera", email: "rumesh@acme.com" }, role: "MEMBER" },
      ],
    });

    render(
      <MemoryRouter>
        <GlobalMembersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Members" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Nethmi Bhagya")).toBeInTheDocument();
      expect(screen.getByText("Rumesh Perera")).toBeInTheDocument();
    });
  });
});
