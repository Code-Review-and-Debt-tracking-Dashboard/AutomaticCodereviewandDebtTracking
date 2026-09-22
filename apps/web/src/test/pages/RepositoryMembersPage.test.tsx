import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryMembersPage } from "../../pages/repositories/RepositoryMembersPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe("RepositoryMembersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders repository members from the API", async () => {
    mockedApi.get.mockResolvedValue({
      data: [
        { id: "rm-1", userId: "u1", user: { name: "Kasun Perera", email: "kasun@acme.com" }, role: "DEVELOPER" },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/repositories/repo-1/members"]}>
        <Routes>
          <Route path="/repositories/:repoId/members" element={<RepositoryMembersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Members" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Kasun Perera")).toBeInTheDocument();
      expect(screen.getByText("kasun@acme.com")).toBeInTheDocument();
    });
  });
});
