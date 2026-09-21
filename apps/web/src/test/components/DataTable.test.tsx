import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "../../components/ui/DataTable";

describe("DataTable Component", () => {
  it("renders headers and cells properly", () => {
    render(
      <DataTable>
        <DataTableHead>
          <DataTableHeaderCell>Name</DataTableHeaderCell>
          <DataTableHeaderCell align="right">Score</DataTableHeaderCell>
        </DataTableHead>
        <DataTableBody>
          <DataTableRow>
            <DataTableCell>Repo A</DataTableCell>
            <DataTableCell align="right">92</DataTableCell>
          </DataTableRow>
        </DataTableBody>
      </DataTable>,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Repo A")).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
  });

  it("handles row click events", async () => {
    const handleRowClick = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable>
        <DataTableBody>
          <DataTableRow onClick={handleRowClick}>
            <DataTableCell>Clickable Row</DataTableCell>
          </DataTableRow>
        </DataTableBody>
      </DataTable>,
    );

    await user.click(screen.getByText("Clickable Row"));
    expect(handleRowClick).toHaveBeenCalledTimes(1);
  });
});
