import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { GlobalAnalyticsPage } from "../../pages/global/GlobalAnalyticsPage";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

function renderAnalyticsPage() {
  return render(
    <MemoryRouter>
      <GlobalAnalyticsPage />
    </MemoryRouter>,
  );
}

describe("GlobalAnalyticsPage", () => {
  it("renders page header and stat metrics", () => {
    renderAnalyticsPage();

    expect(screen.getByRole("heading", { name: "Organization Analytics" })).toBeInTheDocument();
    expect(screen.getAllByText("Average Health Score")[0]).toBeInTheDocument();
  });

  it("filters repository analytics table using search input", async () => {
    const user = userEvent.setup();
    renderAnalyticsPage();

    expect(screen.getByText("AutomaticCodeReview")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search repositories.../i);
    await user.type(searchInput, "AnalysisWorker");

    expect(screen.queryByText("AutomaticCodeReview")).not.toBeInTheDocument();
    expect(screen.getByText("AnalysisWorker")).toBeInTheDocument();
  });
});
