import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { RepositoriesPage } from "../../pages/repositories/RepositoriesPage";

const { selectedOrg } = vi.hoisted(() => ({
  selectedOrg: {
    id: "org-1",
    githubOrgId: "github-1",
    login: "acme",
    name: "Acme Engineering",
    avatarUrl: null,
    type: "Organization",
    role: "OWNER",
  },
}));

vi.mock("../../lib/apiClient", () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({ selectedOrg: selectedOrg }),
}));

const mockedApi = vi.mocked(api);

function renderPage() {
  return render(
    <MemoryRouter>
      <RepositoriesPage />
    </MemoryRouter>,
  );
}

const repository = {
  id: "repo-1",
  name: "code-health",
  fullName: "acme/code-health",
  language: "TypeScript",
  defaultBranch: "main",
  isActive: true,
  orgId: "org-1",
  healthScore: 91,
  openFindings: 3,
  debtMinutes: 95,
  lastAnalyzedAt: "2026-09-19T12:00:00.000Z",
  private: true,
};

describe("RepositoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading and then renders repositories from the API", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [repository] });
    renderPage();

    expect(screen.getByText(/Loading repositories from Postgres/)).toBeInTheDocument();
    expect(await screen.findByText("code-health")).toBeInTheDocument();
    expect(screen.getByText("1 repositories found")).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/orgs/org-1/repos");
  });

  it("shows an empty state when the organization has no repositories", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    renderPage();

    expect(await screen.findByRole("heading", { name: "No repositories found" })).toBeInTheDocument();
    expect(screen.getByText("No repositories match your current search or organization selection.")).toBeInTheDocument();
  });

  it("shows the API error and supports retry", async () => {
    mockedApi.get
      .mockRejectedValueOnce({ response: { data: { error: { message: "Organization unavailable" } } } })
      .mockResolvedValueOnce({ data: [repository] });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Organization unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.queryByText("Organization unavailable")).not.toBeInTheDocument();
      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });
  });

  it("filters displayed repositories by search text", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: [
        repository,
        { ...repository, id: "repo-2", name: "worker", fullName: "acme/worker", language: "Python" },
      ],
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("code-health");
    await user.type(screen.getByPlaceholderText("Search repositories..."), "does-not-exist");

    await waitFor(() => {
      expect(screen.queryByText("code-health")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "No repositories found" })).toBeInTheDocument();
    });
  });

  it("unlinks a repository from the card menu after confirming", async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValue({ data: [repository] });
    mockedApi.delete.mockResolvedValue(undefined as never);
    renderPage();

    expect(await screen.findByText("code-health")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /repository actions/i }));
    await user.click(screen.getByRole("button", { name: /unlink repository/i }));

    // confirmation first — the webhook is removed from GitHub
    expect(screen.getByRole("heading", { name: /unlink repository/i })).toBeInTheDocument();
    expect(mockedApi.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^unlink$/i }));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith("/api/repos/repo-1");
    });
  });

  it("does not unlink when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValue({ data: [repository] });
    mockedApi.delete.mockResolvedValue(undefined as never);
    renderPage();

    expect(await screen.findByText("code-health")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /repository actions/i }));
    await user.click(screen.getByRole("button", { name: /unlink repository/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockedApi.delete).not.toHaveBeenCalled();
  });
});