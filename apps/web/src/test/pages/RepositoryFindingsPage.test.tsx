import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { RepositoryFindingsPage } from "../../pages/repositories/RepositoryFindingsPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repositories/repo-1/findings"]}>
      <Routes>
        <Route path="/repositories/:repoId/findings" element={<RepositoryFindingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RepositoryFindingsPage", () => {
  it("renders page header and findings list", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument();
    expect(screen.getByText("SQL query constructed using user input")).toBeInTheDocument();
    expect(screen.getByText("src/api/users.ts")).toBeInTheDocument();
  });

  it("filters findings table using search input", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText("SQL query constructed using user input")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search findings.../i);
    await user.type(searchInput, "Unused variable");

    expect(screen.queryByText("SQL query constructed using user input")).not.toBeInTheDocument();
    expect(screen.getByText("Unused variable detected")).toBeInTheDocument();
  });
});
