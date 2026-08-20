import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Flame } from "lucide-react";

import {
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  EmptyState,
} from "../ui";

export interface HotspotFile {
  file: string;
  totalFindings: number;
  newFindings: number;
  bySeverity: { critical: number; high: number; medium: number; low: number; info: number };
  debtMinutes: number;
}

type SortKey = "file" | "totalFindings" | "newFindings" | "debtMinutes";

interface HotspotTableProps {
  files: HotspotFile[];
  onRowClick?: (file: string) => void;
}

function formatDebt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function HotspotTable({ files, onRowClick }: HotspotTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalFindings");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...files];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp =
        typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [files, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (column !== sortKey) return <ChevronsUpDown size={13} className="opacity-40" />;
    return sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="No hotspots yet"
        description="Run an analysis on this repository to see its worst-offending files."
      />
    );
  }

  return (
    <DataTable>
      <DataTableHead>
        <DataTableHeaderCell>#</DataTableHeaderCell>
        <DataTableHeaderCell>
          <button className="flex items-center gap-1" onClick={() => toggleSort("file")}>
            File <SortIcon column="file" />
          </button>
        </DataTableHeaderCell>
        <DataTableHeaderCell align="right">
          <button className="ml-auto flex items-center gap-1" onClick={() => toggleSort("totalFindings")}>
            Total Issues <SortIcon column="totalFindings" />
          </button>
        </DataTableHeaderCell>
        <DataTableHeaderCell align="right">
          <button className="ml-auto flex items-center gap-1" onClick={() => toggleSort("newFindings")}>
            New Issues <SortIcon column="newFindings" />
          </button>
        </DataTableHeaderCell>
        <DataTableHeaderCell align="right">
          <button className="ml-auto flex items-center gap-1" onClick={() => toggleSort("debtMinutes")}>
            Debt <SortIcon column="debtMinutes" />
          </button>
        </DataTableHeaderCell>
      </DataTableHead>
      <DataTableBody>
        {sorted.map((f, i) => (
          <DataTableRow key={f.file} onClick={onRowClick ? () => onRowClick(f.file) : undefined}>
            <DataTableCell className="text-muted-foreground">{i + 1}</DataTableCell>
            <DataTableCell className="max-w-[320px] truncate font-mono text-xs">
              <span title={f.file}>{f.file}</span>
            </DataTableCell>
            <DataTableCell align="right">{f.totalFindings}</DataTableCell>
            <DataTableCell align="right">
              {f.newFindings > 0 ? (
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                  +{f.newFindings}
                </span>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </DataTableCell>
            <DataTableCell align="right">{formatDebt(f.debtMinutes)}</DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}
