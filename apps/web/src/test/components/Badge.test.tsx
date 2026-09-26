import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../../components/ui/Badge";

describe("Badge Component", () => {
  it("renders children content correctly", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies variant classes correctly", () => {
    const { container } = render(<Badge variant="success">Passed</Badge>);
    expect(container.firstChild).toHaveClass("bg-success/10", "text-success");
  });

  it("renders a dot indicator when dot prop is true", () => {
    const { container } = render(<Badge dot>Online</Badge>);
    const dotElement = container.querySelector(".rounded-full.bg-current");
    expect(dotElement).toBeInTheDocument();
  });

  it("combines custom className with default classes", () => {
    const { container } = render(<Badge className="custom-test-class">Custom</Badge>);
    expect(container.firstChild).toHaveClass("custom-test-class");
  });
});
