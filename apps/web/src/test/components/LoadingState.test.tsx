import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingState } from "../../components/ui/LoadingState";

describe("LoadingState Component", () => {
  it("renders loading message", () => {
    render(<LoadingState message="Loading data..." />);
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });
});
