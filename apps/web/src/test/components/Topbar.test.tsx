import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Topbar } from "../../components/layout/Topbar";

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
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
    logout: vi.fn(),
  }),
}));

vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({
    orgs: [{ id: "org-1", login: "acme", name: "Acme Corp", avatarUrl: null }],
    selectedOrg: { id: "org-1", login: "acme", name: "Acme Corp", avatarUrl: null },
    setSelectedOrg: vi.fn(),
  }),
}));

describe("Topbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the organization switcher with the selected org name", () => {
    render(
      <MemoryRouter>
        <Topbar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders the notifications bell button", () => {
    render(
      <MemoryRouter>
        <Topbar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });

  it("renders the toggle theme button", () => {
    render(
      <MemoryRouter>
        <Topbar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });
});
