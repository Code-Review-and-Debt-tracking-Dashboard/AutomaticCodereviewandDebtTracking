import { ChevronDown } from "lucide-react";

/*
 * =========================================================
 * SELECT — Styled dropdown select
 * =========================================================
 *
 * A native HTML select wrapped with consistent styling
 * and a chevron indicator. Used inside FilterBar and
 * standalone for filter dropdowns.
 */

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          appearance-none rounded-xl border border-border
          bg-card py-2.5 pl-3 pr-9 text-xs font-medium
          text-foreground outline-none
          transition
          hover:border-primary/40
          focus:border-primary/50
          focus:ring-4 focus:ring-primary/10
        "
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <ChevronDown
        size={14}
        className="
          pointer-events-none absolute right-2.5 top-1/2
          -translate-y-1/2 text-muted-foreground
        "
      />
    </div>
  );
}
