interface LogoProps {
  variant?: "mark" | "full";
  size?: number;
  className?: string;
}

/*
 * CodePulse mark — an open bracket with a health trace running out of it,
 * ending on a commit dot. Inherits colour from the parent via currentColor.
 */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      <path d="M14 5.5 L5.5 16 L14 26.5" strokeWidth="2.4" opacity="0.45" />
      <path d="M10.5 16 H16 L18.5 9.5 L22 22.5 L24 16 H26" strokeWidth="2.2" />
      <circle cx="28.4" cy="16" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Logo({ variant = "full", size = 28, className = "" }: LogoProps) {
  if (variant === "mark") {
    return <LogoMark size={size} className={`text-primary ${className}`} />;
  }

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} className="shrink-0 text-primary" />

      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">
          CodePulse
        </span>
        <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          code health
        </span>
      </span>
    </span>
  );
}
