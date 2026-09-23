import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/*
 * =========================================================
 * BACK LINK — Navigational back link
 * =========================================================
 *
 * Replaces the repeated pattern of a ChevronLeft + text
 * back-navigation button used across repository sub-pages.
 */

interface BackLinkProps {
  /** URL to navigate to */
  to: string;
  /** Link label (default: "Back") */
  label?: string;
  className?: string;
}

export function BackLink({
  to,
  label = "Back",
  className = "",
}: BackLinkProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={`
        mb-4 inline-flex items-center gap-1.5
        font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground
        transition-colors hover:text-foreground
        ${className}
      `}
    >
      <ChevronLeft size={13} />
      {label}
    </button>
  );
}
