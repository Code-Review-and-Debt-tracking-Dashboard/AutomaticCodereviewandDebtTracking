import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "../../components/ui/FilterBar";

describe("FilterBar", () => {
  it("renders the search input and optional filters", () => {
    render(
      <FilterBar
        searchPlaceholder="Search repositories"
        searchValue=""
        onSearchChange={vi.fn()}
        filters={[{ value: "All", onChange: vi.fn(), options: ["All", "TypeScript"] }]}
      />,
    );

    expect(screen.getByPlaceholderText("Search repositories")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("All");
  });

  it("reports typing and filter changes", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onFilterChange = vi.fn();

    render(
      <FilterBar
        searchValue=""
        onSearchChange={onSearchChange}
        filters={[{ value: "All", onChange: onFilterChange, options: ["All", "Critical"] }]}
      />,
    );

    await user.type(screen.getByRole("textbox"), "security");
    await user.selectOptions(screen.getByRole("combobox"), "Critical");

    expect(onSearchChange).toHaveBeenLastCalledWith("y");
    expect(onSearchChange).toHaveBeenCalledTimes(8);
    expect(onFilterChange).toHaveBeenCalledWith("Critical");
  });
});