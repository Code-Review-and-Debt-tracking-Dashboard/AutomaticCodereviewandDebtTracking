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

interface FilterBarProps {
  /** Search placeholder text */
  placeholder?: string;
  /** Current search value */
  searchValue: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;
  /** Optional keyboard shortcut key hint (e.g. "/") */
  shortcutKey?: string;
  /** Filter dropdowns rendered on the right */
  children?: ReactNode;
  className?: string;
}

export function FilterBar({
  placeholder = "Search...",
  searchValue,
  onSearchChange,
  shortcutKey,
  children,
  className = "",
}: FilterBarProps) {
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
          flex flex-1 items-center gap-2 rounded-xl
          border border-border bg-card px-3 py-2.5
          transition
          focus-within:border-primary/50
          focus-within:ring-4 focus-within:ring-primary/10
        "
      >
        <Search
          size={17}
          className="shrink-0 text-muted-foreground"
        />

        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="
            w-full bg-transparent text-sm outline-none
            placeholder:text-muted-foreground
          "
        />

        {shortcutKey && (
          <kbd
            className="
              hidden rounded-md border border-border bg-muted
              px-1.5 py-0.5 text-[10px] text-muted-foreground
              lg:block
            "
          >
            {shortcutKey}
          </kbd>
        )}
      </div>

      {/* Filter Dropdowns */}
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
