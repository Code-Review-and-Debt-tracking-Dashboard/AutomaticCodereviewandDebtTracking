import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LinkRepositoryModal } from "../../components/repositories/LinkRepositoryModal";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({
    selectedOrg: { id: "org-1", login: "acme-corp", name: "Acme Corp" },
  }),
}));

const mockedApi = vi.mocked(api);

const mockAvailableRepos = [
  {
    githubRepoId: "101",
    name: "backend-service",
    fullName: "acme-corp/backend-service",
    htmlUrl: "https://github.com/acme-corp/backend-service",
    cloneUrl: "https://github.com/acme-corp/backend-service.git",
    defaultBranch: "main",
    language: "TypeScript",
    private: true,
    isAlreadyLinked: false,
  },
  {
    githubRepoId: "102",
    name: "frontend-app",
    fullName: "acme-corp/frontend-app",
    htmlUrl: "https://github.com/acme-corp/frontend-app",
    cloneUrl: "https://github.com/acme-corp/frontend-app.git",
    defaultBranch: "main",
    language: "TypeScript",
    private: false,
    isAlreadyLinked: true,
  },
];

describe("LinkRepositoryModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders available repositories when modal opens", async () => {
    // Component calls api.get<{ data: AvailableRepo[] }>(...) and reads res.data
    mockedApi.get.mockResolvedValueOnce({ data: mockAvailableRepos });

    render(
      <LinkRepositoryModal
        isOpen={true}
        onClose={vi.fn()}
        onRepoLinked={vi.fn()}
      />,
    );

    expect(screen.getByText("Link Repository")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("backend-service")).toBeInTheDocument();
      expect(screen.getByText("frontend-app")).toBeInTheDocument();
    });

    expect(screen.getByText("Linked")).toBeInTheDocument();
  });

  it("links selected repositories via bulk-link when Link button is clicked", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockAvailableRepos });
    // Component calls api.post<{ jobId: string; total: number }>(...) and reads res.jobId
    mockedApi.post.mockResolvedValueOnce({ jobId: "job-xyz", total: 1 });

    const handleRepoLinked = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <LinkRepositoryModal
        isOpen={true}
        onClose={handleClose}
        onRepoLinked={handleRepoLinked}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("backend-service")).toBeInTheDocument();
    });

    // Click the repo row to select it (only non-linked repos are selectable)
    const repoRow = screen.getByText("backend-service").closest("div[class*='cursor-pointer']") ??
      screen.getByText("backend-service").closest("div");
    await user.click(repoRow!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Link 1 repository/i })).toBeInTheDocument();
    });

    const linkBtn = screen.getByRole("button", { name: /Link 1 repository/i });
    await user.click(linkBtn);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        "/api/orgs/org-1/repos/bulk-link",
        { githubRepoIds: ["101"] },
      );
    });
  });

  it("filters available repositories using search input", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockAvailableRepos });
    const user = userEvent.setup();

    render(
      <LinkRepositoryModal
        isOpen={true}
        onClose={vi.fn()}
        onRepoLinked={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("backend-service")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search available repositories/i);
    await user.type(searchInput, "frontend");

    expect(screen.queryByText("backend-service")).not.toBeInTheDocument();
    expect(screen.getByText("frontend-app")).toBeInTheDocument();
  });
});
