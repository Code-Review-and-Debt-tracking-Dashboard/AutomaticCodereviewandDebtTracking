import type { ReactNode } from "react";
import { Search } from "lucide-react";

/*
 * =========================================================
 * FILTER BAR — Search + dropdown filters row
 * =========================================================
 *
 * Combines a search input with optional filter dropdowns
 * in a consistent layout used on Dashboard, Findings,
 * Notifications, Analytics, and Repositories pages.
 */

import { Select } from "./Select";
import type { SelectOptionItem } from "./Select";

interface FilterBarItem {
  value: string;
  onChange: (value: string) => void;
  options: SelectOptionItem[];
}

interface FilterBarProps {
  /** Search placeholder text */
  placeholder?: string;
  /** Search placeholder text alias */
  searchPlaceholder?: string;
  /** Current search value */
  searchValue: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;
  /** Optional keyboard shortcut key hint (e.g. "/") */
  shortcutKey?: string;
  /** Optional array of filter objects */
  filters?: FilterBarItem[];
  /** Filter dropdowns rendered on the right */
  children?: ReactNode;
  className?: string;
}

export function FilterBar({
  placeholder = "Search...",
  searchPlaceholder,
  searchValue,
  onSearchChange,
  shortcutKey,
  filters,
  children,
  className = "",
}: FilterBarProps) {
  const actualPlaceholder = searchPlaceholder ?? placeholder;

  return (
    <div
      className={`
        flex flex-col gap-3 sm:flex-row sm:items-center
        ${className}
      `}
    >
      {/* Search Input */}
      <div
        className="
          flex h-9 flex-1 items-center gap-2 rounded-md
          border border-border bg-card px-2.5
          transition-colors focus-within:border-primary/50
        "
      >
        <Search size={15} className="shrink-0 text-muted-foreground" />

        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={actualPlaceholder}
          className="
            w-full bg-transparent text-[13px] outline-none
            placeholder:text-muted-foreground
          "
        />

        {shortcutKey && (
          <kbd
            className="
              hidden rounded-xs border border-border px-1
              font-mono text-[10px] text-muted-foreground lg:block
            "
          >
            {shortcutKey}
          </kbd>
        )}
      </div>

      {/* Filter Dropdowns */}
      {filters && filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f, idx) => (
            <Select
              key={idx}
              value={f.value}
              onChange={f.onChange}
              options={f.options}
            />
          ))}
        </div>
      )}

      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
