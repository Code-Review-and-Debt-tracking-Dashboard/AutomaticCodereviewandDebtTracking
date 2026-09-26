import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "../../components/auth/ProtectedRoute";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { id: "u1" } }),
}));

describe("ProtectedRoute Component", () => {
  it("renders protected outlet content when authenticated", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
