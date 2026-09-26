import type { ReactNode } from "react";

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

export function DataTableBody({ children, className = "" }: TableProps) {
  return (
    <tbody className={`divide-y divide-border/60 ${className}`}>
      {children}
    </tbody>
  );
}

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
