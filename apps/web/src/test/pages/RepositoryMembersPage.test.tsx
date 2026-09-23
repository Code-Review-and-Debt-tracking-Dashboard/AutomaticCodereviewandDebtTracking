import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryMembersPage } from "../../pages/repositories/RepositoryMembersPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

// The shape the API actually returns — flat, not nested under `user`.
const members = [
  {
    id: "rm-1",
    userId: "u1",
    username: "kasunperera",
    avatarUrl: null,
    role: "DEVELOPER",
    status: "ACTIVE",
    addedAt: "2026-09-20T10:00:00.000Z",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1/members"]}>
      <Routes>
        <Route path="/repositories/:repoId/members" element={<RepositoryMembersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryMembersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: members } as any);
  });

  it("requests the members endpoint under /api", async () => {
    renderPage();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/api/repos/repo-1/members");
    });
  });

  it("renders members using the fields the API returns", async () => {
    renderPage();

    expect(await screen.findByText("kasunperera")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
  });

  it("adds a viewer, which is the role for non-technical people", async () => {
    const user = userEvent.setup();
    mockedApi.post.mockResolvedValue(undefined as never);
    renderPage();

    await user.click(screen.getByRole("button", { name: /add member/i }));
    await user.type(screen.getByLabelText(/github username/i), "pm-nimal");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/api/repos/repo-1/members", {
        username: "pm-nimal",
        role: "VIEWER",
      });
    });
  });

  it("explains what the selected role can do", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /add member/i }));

    expect(screen.getByText(/people who do not work in the code/i)).toBeInTheDocument();
  });

  it("removes a member by user id", async () => {
    const user = userEvent.setup();
    mockedApi.delete.mockResolvedValue(undefined as never);
    renderPage();

    await user.click(await screen.findByRole("button", { name: /remove kasunperera/i }));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith("/api/repos/repo-1/members/u1");
    });
  });

  it("shows an empty state rather than a blank list", async () => {
    mockedApi.get.mockResolvedValue({ data: [] } as any);
    renderPage();

    expect(await screen.findByText(/No one has been added yet/i)).toBeInTheDocument();
  });
});
