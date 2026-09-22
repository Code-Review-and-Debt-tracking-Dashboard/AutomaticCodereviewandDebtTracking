import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "../../pages/auth/LoginPage";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    status: "unauthenticated",
    authLostReason: null,
  }),
}));

describe("LoginPage", () => {
  it("renders welcome header and GitHub login button", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue with GitHub/i })).toBeInTheDocument();
    expect(screen.getByText("No password stored by the dashboard")).toBeInTheDocument();
  });

  it("redirects window.location on GitHub login click", async () => {
    const user = userEvent.setup();
    const originalLocation = window.location;

    // @ts-ignore
    delete (window as any).location;
    // @ts-ignore
    (window as any).location = { href: "" };

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const loginBtn = screen.getByRole("button", { name: /Continue with GitHub/i });
    await user.click(loginBtn);

    expect((window as any).location.href).toContain("/auth/github");

    (window as any).location = originalLocation;
  });
});
