import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BackLink } from "../../components/ui/BackLink";

describe("BackLink Component", () => {
  it("renders label correctly", () => {
    render(
      <MemoryRouter>
        <BackLink to="/dashboard" label="Back to dashboard" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Back to dashboard")).toBeInTheDocument();
  });
});
