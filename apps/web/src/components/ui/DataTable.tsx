import type { ReactNode } from "react";

/*
 * =========================================================
 * DATA TABLE — Styled table with headers and rows
 * =========================================================
 *
 * Hairline dividers and mono column headers so long lists
 * of findings stay scannable.
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
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}

/* ---------- Table Head ---------- */

export function DataTableHead({ children, className = "" }: TableProps) {
  return (
    <thead>
      <tr
        className={`
          border-b border-border text-left font-mono text-[10px]
          uppercase tracking-[0.12em] text-muted-foreground
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
    <tbody className={`divide-y divide-border/60 ${className}`}>
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
        transition-colors hover:bg-accent/40
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

function alignClass(align: CellProps["align"]) {
  return align === "right"
    ? "text-right"
    : align === "center"
      ? "text-center"
      : "text-left";
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
      className={`px-4 py-2.5 font-medium ${alignClass(align)} ${className}`}
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
      className={`px-4 py-3 ${alignClass(align)} ${className}`}
    >
      {children}
    </td>
  );
}
