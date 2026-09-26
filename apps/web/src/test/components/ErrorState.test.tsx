import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorState } from "../../components/ui/ErrorState";

describe("ErrorState Component", () => {
  it("renders error message and title", () => {
    render(<ErrorState title="Something went wrong" message="Failed to load resource" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Failed to load resource")).toBeInTheDocument();
  });
});
