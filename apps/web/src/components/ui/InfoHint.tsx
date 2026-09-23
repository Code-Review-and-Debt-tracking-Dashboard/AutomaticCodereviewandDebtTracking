import { Info } from "lucide-react";
import { useId } from "react";

/*
 * =========================================================
 * INFO HINT
 * =========================================================
 *
 * A small "i" that explains a metric in plain words on hover. It is a real
 * button so it also opens on keyboard focus — a hover-only hint is invisible
 * to anyone not using a mouse.
 */

interface InfoHintProps {
  /** Plain-English explanation. Written for someone who does not read code. */
  text: string;
  className?: string;
}

export function InfoHint({ text, className = "" }: InfoHintProps) {
  const id = useId();

  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label="What does this mean?"
        aria-describedby={id}
        className="inline-flex cursor-help text-muted-foreground transition hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        <Info size={13} />
      </button>

      <span
        id={id}
        role="tooltip"
        className="
          pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2
          rounded-md border border-border bg-popover p-3 text-left font-sans text-xs font-normal
          normal-case tracking-normal leading-5 text-muted-foreground opacity-0 shadow-lg transition
          group-hover:opacity-100 group-focus-within:opacity-100
        "
      >
        {text}
      </span>
    </span>
  );
}
