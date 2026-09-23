import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InfoHint } from "../../components/ui/InfoHint";
import { StatCard } from "../../components/ui/StatCard";
import { Code2 } from "lucide-react";

describe("InfoHint", () => {
  it("renders the explanation as a tooltip", () => {
    render(<InfoHint text="How long it would take to fix everything found." />);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "How long it would take to fix everything found.",
    );
  });

  // hover-only would hide the explanation from keyboard users entirely
  it("is reachable as a focusable control, not hover-only", () => {
    render(<InfoHint text="Plain explanation." />);

    const trigger = screen.getByRole("button", { name: /what does this mean/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  });
});

describe("StatCard help", () => {
  it("shows the explanation when one is given", () => {
    render(<StatCard title="Technical Debt" value="2h 25m" icon={Code2} help="An estimate of fix time." />);

    expect(screen.getByRole("tooltip")).toHaveTextContent("An estimate of fix time.");
  });

  it("stays clean when no explanation is given", () => {
    render(<StatCard title="Repositories" value="3" icon={Code2} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
