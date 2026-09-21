import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { GlobalFindingsPage } from "../../pages/global/GlobalFindingsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <GlobalFindingsPage />
    </MemoryRouter>,
  );
}

describe("GlobalFindingsPage", () => {
  it("renders findings and summary statistics", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "All Findings" })).toBeInTheDocument();
    expect(screen.getByText("SQL query constructed using raw user input string concatenation")).toBeInTheDocument();
    expect(screen.getByText("Total Findings")).toBeInTheDocument();
    expect(screen.getByText("183")).toBeInTheDocument();
  });

  it("filters findings by search text", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByPlaceholderText("Search findings by title, file path, repository..."),
      "redis",
    );

    expect(screen.getByText("Hardcoded timeout constant in Redis worker connection")).toBeInTheDocument();
    expect(screen.queryByText("SQL query constructed using raw user input string concatenation")).not.toBeInTheDocument();
  });

  it("filters findings by severity", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getAllByRole("combobox")[1], "Critical");

    expect(screen.getByText("SQL query constructed using raw user input string concatenation")).toBeInTheDocument();
    expect(screen.queryByText("Function cyclomatic complexity exceeds maximum threshold (18)")).not.toBeInTheDocument();
  });
});