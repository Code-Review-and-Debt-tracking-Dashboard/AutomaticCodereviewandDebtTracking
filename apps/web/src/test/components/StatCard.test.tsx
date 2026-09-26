import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import { describe, expect, it } from "vitest";

import { StatCard } from "../../components/ui/StatCard";

describe("StatCard Component", () => {
  it("renders title, value, and change indicator correctly", () => {
    render(
      <StatCard
        title="Avg Health Score"
        value="88"
        change="+5% vs last week"
        trend="up"
        icon={Activity}
      />,
    );

    expect(screen.getByText("Avg Health Score")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("+5% vs last week")).toBeInTheDocument();
  });

  it("applies down trend color correctly when trend is down", () => {
    const { container } = render(
      <StatCard
        title="Technical Debt"
        value="24h"
        change="+4h"
        trend="down"
        icon={Activity}
      />,
    );

    const changeEl = screen.getByText("+4h");
    expect(changeEl).toHaveClass("text-destructive");
  });
});
