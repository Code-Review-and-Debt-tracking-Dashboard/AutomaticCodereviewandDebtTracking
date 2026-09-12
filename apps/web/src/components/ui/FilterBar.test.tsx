import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("renders the search field and forwards input changes", () => {
    const onSearchChange = vi.fn();

    render(
      <FilterBar
        searchPlaceholder="Search pull requests"
        searchValue=""
        onSearchChange={onSearchChange}
      />,
    );

    const input = screen.getByPlaceholderText("Search pull requests");
    fireEvent.change(input, { target: { value: "security" } });

    expect(onSearchChange).toHaveBeenCalledWith("security");
  });

  it("renders filter options without losing the search control", () => {
    render(
      <FilterBar
        searchValue=""
        onSearchChange={vi.fn()}
        filters={[{
          value: "All",
          onChange: vi.fn(),
          options: ["All", "Critical", "High"],
        }]}
      />,
    );

    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
  });
});