import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "../../components/ui/EmptyState";

function TestIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <span data-testid="test-icon" data-size={size} className={className}>
      Icon
    </span>
  );
}

describe("EmptyState Component", () => {
  it("renders the title", () => {
    render(
      <EmptyState
        icon={TestIcon}
        title="No repositories found"
      />,
    );

    expect(screen.getByText("No repositories found")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(
      <EmptyState
        icon={TestIcon}
        title="No repositories found"
        description="There are no repositories to display."
      />,
    );

    expect(
      screen.getByText("There are no repositories to display."),
    ).toBeInTheDocument();
  });

  it("does not render the description when not provided", () => {
    render(
      <EmptyState
        icon={TestIcon}
        title="No repositories found"
      />,
    );

    expect(
      screen.queryByText("There are no repositories to display."),
    ).not.toBeInTheDocument();
  });

  it("renders the provided icon with the correct size and class", () => {
    render(
      <EmptyState
        icon={TestIcon}
        title="No data"
      />,
    );

    const icon = screen.getByTestId("test-icon");

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("data-size", "24");
    expect(icon).toHaveClass("text-muted-foreground");
  });

  it("renders the action when provided", () => {
    render(
      <EmptyState
        icon={TestIcon}
        title="No repositories"
        action={<button>Add Repository</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add Repository" }),
    ).toBeInTheDocument();
  });

  it("does not render the action when not provided", () => {
    render(
      <EmptyState
        icon={TestIcon}
        title="No repositories"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Add Repository" }),
    ).not.toBeInTheDocument();
  });

  it("applies a custom className", () => {
    const { container } = render(
      <EmptyState
        icon={TestIcon}
        title="No data"
        className="custom-empty-state"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-empty-state");
  });

  it("renders the complete empty state correctly", () => {
    render(
      <EmptyState
        icon={TestIcon}
        title="No repositories found"
        description="Try adding a repository to get started."
        action={<button>Add Repository</button>}
      />,
    );

    expect(screen.getByText("No repositories found")).toBeInTheDocument();
    expect(
      screen.getByText("Try adding a repository to get started."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Repository" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });
});