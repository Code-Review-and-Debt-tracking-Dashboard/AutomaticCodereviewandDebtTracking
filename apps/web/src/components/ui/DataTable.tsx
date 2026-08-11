import type { ReactNode } from "react";

/*
 * =========================================================
 * DATA TABLE — Styled table with headers and rows
 * =========================================================
 *
 * Provides a consistent table layout with headers,
 * hover rows, and dividers. Used on Analytics
 * (Repository Overview) and Findings list pages.
 */

/* ---------- Table Root ---------- */

interface TableProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function DataTable({ children, className = "" }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  );
}

/* ---------- Table Head ---------- */

export function DataTableHead({ children, className = "" }: TableProps) {
  return (
    <thead>
      <tr
        className={`
          border-b border-border/60 text-left text-xs
          font-semibold uppercase tracking-wider
          text-muted-foreground
          ${className}
        `}
      >
        {children}
      </tr>
    </thead>
  );
}

/* ---------- Table Body ---------- */

export function DataTableBody({ children, className = "" }: TableProps) {
  return (
    <tbody className={`divide-y divide-border/50 ${className}`}>
      {children}
    </tbody>
  );
}

/* ---------- Table Row ---------- */

export function DataTableRow({ children, className = "", onClick }: TableProps) {
  return (
    <tr
      onClick={onClick}
      className={`
        transition-colors hover:bg-muted/30
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </tr>
  );
}

/* ---------- Table Header Cell ---------- */

interface CellProps {
  children?: ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  colSpan?: number;
}

export function DataTableHeaderCell({
  children,
  className = "",
  align = "left",
  colSpan,
}: CellProps) {
  return (
    <th
      colSpan={colSpan}
      className={`
        px-4 py-3
        ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}
        ${className}
      `}
    >
      {children}
    </th>
  );
}

/* ---------- Table Cell ---------- */

export function DataTableCell({
  children,
  className = "",
  align = "left",
  colSpan,
}: CellProps) {
  return (
    <td
      colSpan={colSpan}
      className={`
        px-4 py-4
        ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}
        ${className}
      `}
    >
      {children}
    </td>
  );
}
