import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DashboardPage } from "../../pages/dashboard/DashboardPage";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

function renderDashboardPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  it("renders page header and stat cards", () => {
    renderDashboardPage();

    expect(screen.getByText(/overview of your code quality/i)).toBeInTheDocument();
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Average Health")).toBeInTheDocument();
    expect(screen.getByText("Open Findings")).toBeInTheDocument();
    expect(screen.getByText("Technical Debt")).toBeInTheDocument();
  });

  it("filters repository table based on search text input", async () => {
    const user = userEvent.setup();
    renderDashboardPage();

    expect(screen.getByText("AutomaticCodeReview")).toBeInTheDocument();
    expect(screen.getByText("MobileDashboard")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search repositories.../i);
    await user.type(searchInput, "Mobile");

    expect(screen.queryByText("AutomaticCodeReview")).not.toBeInTheDocument();
    expect(screen.getByText("MobileDashboard")).toBeInTheDocument();
  });
});
